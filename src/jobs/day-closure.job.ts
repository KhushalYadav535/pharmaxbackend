import cron from 'node-cron';
import prisma from '../config/database';
import { DayStatus, VisitStatus } from '@prisma/client';

export const dayClosureService = {
  /**
   * Run nightly automated closure for any MR shifts left open.
   * Cleans orphan visits, finalizes attendance hours, and terminates active app sessions.
   */
  async runNightlyClosure() {
    console.log('[Nightly Day Closure] 🌙 Starting scheduled automated day closure job...');
    const now = new Date();

    // Query all attendances that are still open today or earlier
    const openAttendances = await prisma.attendance.findMany({
      where: {
        dayStatus: { in: [DayStatus.IN_PROGRESS, DayStatus.DAY_END_REVIEW, 'STARTED' as any] },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      },
    });

    console.log(`[Nightly Day Closure] Found ${openAttendances.length} open shift(s) requiring automated closure.`);

    let closedCount = 0;
    let missedVisitsCount = 0;
    let sessionsExpiredCount = 0;

    for (const attendance of openAttendances) {
      try {
        const attDate = new Date(attendance.date);
        const dayStart = new Date(attDate.getFullYear(), attDate.getMonth(), attDate.getDate(), 0, 0, 0, 0);
        const dayEnd = new Date(attDate.getFullYear(), attDate.getMonth(), attDate.getDate(), 23, 59, 59, 999);

        // 1. Find last completed visit of the day to compute realistic checkout time
        const lastCompletedVisit = await prisma.visit.findFirst({
          where: {
            userId: attendance.userId,
            status: { in: [VisitStatus.REPORTED, VisitStatus.COMPLETED] },
            plannedDate: { gte: dayStart, lte: dayEnd },
          },
          orderBy: { checkOutTime: 'desc' },
        });

        // 2. Determine checkout time
        let checkoutTime: Date;
        if (lastCompletedVisit?.checkOutTime) {
          // 30 min buffer after last visit completed
          checkoutTime = new Date(lastCompletedVisit.checkOutTime.getTime() + 30 * 60 * 1000);
          const maxTime = new Date(attDate.getFullYear(), attDate.getMonth(), attDate.getDate(), 21, 30, 0, 0); // 9:30 PM max
          if (checkoutTime > maxTime) checkoutTime = maxTime;
        } else if (attendance.checkInTime) {
          // If no completed calls, cap at checkIn + 7 hrs or 6:30 PM
          checkoutTime = new Date(attendance.checkInTime.getTime() + 7 * 60 * 60 * 1000);
          const shiftEnd = new Date(attDate.getFullYear(), attDate.getMonth(), attDate.getDate(), 18, 30, 0, 0); // 6:30 PM
          if (checkoutTime > shiftEnd) checkoutTime = shiftEnd;
        } else {
          checkoutTime = new Date(attDate.getFullYear(), attDate.getMonth(), attDate.getDate(), 18, 0, 0, 0);
        }

        // Ensure checkoutTime is at least after checkInTime
        if (attendance.checkInTime && checkoutTime.getTime() <= attendance.checkInTime.getTime()) {
          checkoutTime = new Date(attendance.checkInTime.getTime() + 60 * 60 * 1000); // at least 1 hr
        }

        const durationMinutes = attendance.checkInTime
          ? Math.max(0, Math.round((checkoutTime.getTime() - attendance.checkInTime.getTime()) / (1000 * 60)))
          : 0;

        // 3. Mark orphan PLANNED & NAVIGATING visits as MISSED
        const missedRes = await prisma.visit.updateMany({
          where: {
            userId: attendance.userId,
            status: { in: [VisitStatus.PLANNED, VisitStatus.NAVIGATING] },
            plannedDate: { gte: dayStart, lte: dayEnd },
          },
          data: {
            status: VisitStatus.MISSED,
            missedReason: 'Auto-closed by system at day end',
            remarks: 'Auto-closed by nightly day closure cron at 10:00 PM IST',
          },
        });
        missedVisitsCount += missedRes.count;

        // 4. Mark active or incomplete in-progress visits
        await prisma.visit.updateMany({
          where: {
            userId: attendance.userId,
            status: { in: [VisitStatus.CHECKED_IN, VisitStatus.PREPARING, VisitStatus.ENGAGING, VisitStatus.DETAILING, VisitStatus.PAUSED] },
            plannedDate: { gte: dayStart, lte: dayEnd },
          },
          data: {
            status: VisitStatus.MISSED,
            missedReason: 'Auto-closed incomplete visit at day end',
            remarks: 'Auto-closed by nightly cron job',
            checkOutTime: checkoutTime,
          },
        });

        // 5. Submit any pending report visits
        await prisma.visit.updateMany({
          where: {
            userId: attendance.userId,
            status: { in: [VisitStatus.CHECKED_OUT, VisitStatus.REPORT_PENDING] },
            plannedDate: { gte: dayStart, lte: dayEnd },
          },
          data: {
            status: VisitStatus.REPORTED,
            reportSubmittedAt: checkoutTime,
            remarks: 'Auto-finalized by nightly cron job',
          },
        });

        // 6. Finalize Attendance
        const finalStatus = durationMinutes < 240 ? 'HALF_DAY' : 'PRESENT';
        await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            dayStatus: DayStatus.CLOSED,
            checkOutTime: checkoutTime,
            durationMinutes,
            status: finalStatus as any,
          },
        });

        // 7. Day State Audit Log
        await prisma.dayStateLog.create({
          data: {
            userId: attendance.userId,
            attendanceId: attendance.id,
            fromStatus: attendance.dayStatus as DayStatus,
            toStatus: DayStatus.CLOSED,
          },
        });

        // 8. Expire active user login sessions
        try {
          const activeSessions = await prisma.userSession.findMany({
            where: { userId: attendance.userId, status: 'ACTIVE' },
          });

          for (const s of activeSessions) {
            const sDuration = Math.max(0, Math.round((checkoutTime.getTime() - s.loginAt.getTime()) / (1000 * 60)));
            await prisma.userSession.update({
              where: { id: s.id },
              data: {
                status: 'TIMED_OUT',
                logoutAt: checkoutTime,
                durationMinutes: sDuration,
                logoutReason: 'NIGHTLY_TIMEOUT',
              },
            });
            sessionsExpiredCount++;
          }
        } catch (sessErr) {
          console.warn(`[Nightly Day Closure] Could not expire sessions for user ${attendance.userId}:`, sessErr);
        }

        closedCount++;
        console.log(`[Nightly Day Closure] ✅ Successfully auto-closed day for ${attendance.user?.firstName || 'MR'} (${attendance.userId}). Duration: ${durationMinutes} mins.`);
      } catch (userErr) {
        console.error(`[Nightly Day Closure] ❌ Error auto-closing day for user ${attendance.userId}:`, userErr);
      }
    }

    const summary = {
      closedAttendances: closedCount,
      missedVisitsAutoUpdated: missedVisitsCount,
      sessionsExpired: sessionsExpiredCount,
      timestamp: now.toISOString(),
    };

    console.log('[Nightly Day Closure] 🏁 Completed nightly closure job:', summary);
    return summary;
  },
};

/**
 * Initialize nightly cron job to run every day at 10:00 PM IST (22:00 IST = 16:30 UTC).
 */
export function initDayClosureCron() {
  // '0 22 * * *' with timezone 'Asia/Kolkata' = 10:00 PM every night in India
  cron.schedule(
    '0 22 * * *',
    async () => {
      try {
        await dayClosureService.runNightlyClosure();
      } catch (err) {
        console.error('[Nightly Day Closure] Unhandled error during scheduled execution:', err);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('⏰ [Nightly Day Closure] Cron initialized — scheduled for 10:00 PM IST daily (Asia/Kolkata).');
}
