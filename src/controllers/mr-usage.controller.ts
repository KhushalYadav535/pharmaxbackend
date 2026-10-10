import { Request, Response } from 'express';
import { mrUsageService } from '../services/mr-usage.service';

export const mrUsageController = {
  async getOverview(req: Request, res: Response) {
    try {
      const {
        timeRange,
        startDate,
        endDate,
        search,
        hqId,
        status,
        mrId,
      } = req.query;

      const result = await mrUsageService.getMRUsageOverview({
        timeRange: timeRange as string,
        startDate: startDate as string,
        endDate: endDate as string,
        search: search as string,
        hqId: hqId as string,
        status: status as string,
        mrId: mrId as string,
        requestingUserId: req.user!.userId,
        requestingUserRole: req.user!.role,
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getIndividualReport(req: Request, res: Response) {
    try {
      const mrId = req.params.mrId as string;
      const { timeRange, startDate, endDate } = req.query;

      const result = await mrUsageService.getMRIndividualReport(mrId, {
        timeRange: timeRange as string,
        startDate: startDate as string,
        endDate: endDate as string,
        requestingUserId: req.user!.userId,
        requestingUserRole: req.user!.role,
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500;
      res.status(status).json({ success: false, message: err.message });
    }
  },

  async exportOverviewCSV(req: Request, res: Response) {
    try {
      const { timeRange, startDate, endDate, search, hqId, status } = req.query;

      const result = await mrUsageService.getMRUsageOverview({
        timeRange: timeRange as string,
        startDate: startDate as string,
        endDate: endDate as string,
        search: search as string,
        hqId: hqId as string,
        status: status as string,
        requestingUserId: req.user!.userId,
        requestingUserRole: req.user!.role,
      });

      const headers = [
        'Employee ID',
        'MR Name',
        'Email',
        'Phone',
        'Headquarter / Territory',
        'Current Status',
        'Total Logins',
        'Total Logouts',
        'Total App Usage (Hours)',
        'Total App Usage (Minutes)',
        'Active Days',
        'Avg Daily Usage',
        'Today Logins',
        'Today Usage',
        'Last Active',
      ];

      const rows = result.mrList.map((m) => [
        m.employeeId,
        m.name,
        m.email,
        m.phone,
        m.hq?.name || 'General',
        m.currentStatus,
        m.totalLogins,
        m.totalLogouts,
        m.totalHoursFormatted,
        m.totalMinutes,
        m.activeDaysCount,
        m.avgDailyHoursFormatted,
        m.todayLogins,
        m.todayHoursFormatted,
        m.lastActiveFormatted,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((val) => `"${String(val || '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=MR_App_Usage_Report_${result.dateRange.startDate}_${result.dateRange.endDate}.csv`);
      res.status(200).send(csvContent);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async exportIndividualCSV(req: Request, res: Response) {
    try {
      const mrId = req.params.mrId as string;
      const { timeRange, startDate, endDate } = req.query;

      const result = await mrUsageService.getMRIndividualReport(mrId, {
        timeRange: timeRange as string,
        startDate: startDate as string,
        endDate: endDate as string,
        requestingUserId: req.user!.userId,
        requestingUserRole: req.user!.role,
      });

      const headers = [
        'Session ID',
        'MR Name',
        'Employee Code',
        'Login Date',
        'Login Time',
        'Logout Date',
        'Logout Time',
        'Duration',
        'Duration (Minutes)',
        'Status',
        'Logout Reason',
        'Platform',
        'Device Model',
        'IP Address',
      ];

      const rows = result.sessionLogs.map((s) => [
        s.id,
        result.mr.name,
        result.mr.employeeId,
        s.loginDateStr,
        s.loginTimeStr,
        s.logoutDateStr,
        s.logoutTimeStr,
        s.durationFormatted,
        s.durationMinutes,
        s.status,
        s.logoutReason || '-',
        s.platform,
        s.deviceModel,
        s.ipAddress,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((val) => `"${String(val || '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=MR_Session_Log_${result.mr.employeeId}_${result.dateRange.startDate}.csv`);
      res.status(200).send(csvContent);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
