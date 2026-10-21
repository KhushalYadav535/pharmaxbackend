import prisma from '../config/database';
import { env } from '../config/env';
import { visitService } from './visit.service';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface AgentActionResult {
  actionType:
    | 'DOCTOR_CREATED'
    | 'DOCTOR_UPDATED'
    | 'DOCTOR_DEACTIVATED'
    | 'DOCTOR_SEARCH'
    | 'MR_REPORT'
    | 'REP_LIST'
    | 'PRODUCT_CREATED'
    | 'PRODUCT_UPDATED'
    | 'PRODUCT_LIST'
    | 'RETAILER_CREATED'
    | 'RETAILER_LIST'
    | 'EMPLOYEE_CREATED'
    | 'EMPLOYEE_UPDATED'
    | 'VISIT_ASSIGNED'
    | 'VISITS_CANCELLED'
    | 'ORDERS_SUMMARY'
    | 'APPROVAL_ACTION'
    | 'TERRITORY_CREATED'
    | 'TERRITORY_LIST'
    | 'HOSPITAL_CREATED'
    | 'HOSPITAL_LIST'
    | 'STOCKIST_CREATED'
    | 'STOCKIST_LIST'
    | 'ATTENDANCE_SUMMARY'
    | 'SCHEME_CREATED'
    | 'SCHEME_LIST'
    | 'SAMPLE_SUMMARY'
    | 'TOUR_PLAN_ACTION'
    | 'BROADCAST_SENT'
    | 'TARGET_ACTION'
    | 'EXPENSES_SUMMARY'
    | 'TASK_CREATED'
    | 'DASHBOARD_STATS'
    | 'NAVIGATION';
  title: string;
  data: any;
  message: string;
  link?: string;
}

// ── OpenRouter Tool Definitions (OpenAI-compatible) ──────────────────────────
const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_doctor',
      description: 'Add a new doctor to the system in a specific territory/headquarter. Use when user asks to add or register a doctor.',
      parameters: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'First name of the doctor (e.g. Rajesh)' },
          lastName: { type: 'string', description: 'Last name or surname (e.g. Sharma)' },
          salutation: { type: 'string', description: 'Title/salutation (default: Dr.)', enum: ['Dr.', 'Prof.', 'Dr. (Mrs)', 'Dr. (Ms)'] },
          specialty: { type: 'string', description: 'Medical specialty (e.g. Cardiology, Pediatrics, General Medicine, Orthopedic, Dermatology)' },
          qualification: { type: 'string', description: 'Educational qualification (e.g. MBBS, MD, MS, DNB)' },
          headquarterName: { type: 'string', description: 'Name of the Headquarter/Territory (e.g. Nagpur, Mumbai, Pune, Delhi)' },
          phone: { type: 'string', description: 'Mobile or contact number' },
          city: { type: 'string', description: 'City name' },
          category: { type: 'string', description: 'Category (e.g. Specialist, Consultant, General Practitioner)' },
        },
        required: ['firstName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_team_activity_report',
      description: 'Get daily field activity and visit report for ALL Medical Representatives (MRs) / entire field team today. Shows all reps, how many calls scheduled, completed, and live calls today. Call this when user asks for "MR today report", "all MR report", "team report", or overall reps performance today.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Target date in YYYY-MM-DD format (defaults to today)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mr_activity_report',
      description: 'Fetch the daily activity and visit report for a SINGLE specific Medical Representative (MR) by name (e.g. "Jaya Wandhare", "Ashish Shrivas", "Santosh Telang"). If user asks for all MRs or team report, use get_team_activity_report instead.',
      parameters: {
        type: 'object',
        properties: {
          mrName: { type: 'string', description: 'Name of the specific representative (e.g. Jaya, Ashish, Santosh, Sameer)' },
          date: { type: 'string', description: 'Target date in YYYY-MM-DD format (defaults to today)' },
        },
        required: ['mrName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bulk_cancel_visits',
      description: 'Bulk cancel planned visits for a specific Medical Representative (MR) on a date. Use when visits were planned for wrong route/location or MR reassigned.',
      parameters: {
        type: 'object',
        properties: {
          mrName: { type: 'string', description: 'Name of the representative whose visits to cancel' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today)' },
          reason: { type: 'string', description: 'Reason for cancellation (e.g. Wrong territory planned, MR reassigned, Clinic closed)' },
          includeActive: { type: 'boolean', description: 'Whether to also cancel active/checked-in calls (default false)' },
        },
        required: ['mrName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_headquarter_doctors_count',
      description: 'Get doctor statistics, count, and specialty breakdown for a specific headquarter (e.g. Indore, Nagpur, Wardha, Ujjain, Burhanpur, Dhar, Khargoan) or across all headquarters. Call this whenever the user asks how many doctors are in an HQ/territory or asks for doctor count in a city.',
      parameters: {
        type: 'object',
        properties: {
          headquarterName: { type: 'string', description: 'Name of the headquarter/territory (e.g. Indore, Nagpur, Ujjain, Burhanpur, Wardha, Dhar, Khargoan). If not specified or user asks for total, leave empty.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_doctors',
      description: 'Search doctors in the database by name, specialty, or territory.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords (name, specialty, or city)' },
          headquarterName: { type: 'string', description: 'Optional headquarter filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_field_representatives',
      description: 'List active Medical Representatives (MRs) and sales managers with their headquarters.',
      parameters: {
        type: 'object',
        properties: {
          headquarterName: { type: 'string', description: 'Optional headquarter filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dashboard_summary',
      description: 'Get current real-time overview of field operations: total calls today, completed visits, active MRs.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_doctor',
      description: 'Update existing doctor details (phone, specialty, qualification, classification A/B/C/A+, city, or headquarter).',
      parameters: {
        type: 'object',
        properties: {
          doctorNameOrCode: { type: 'string', description: 'Doctor full name or code (e.g. "Dr. Ramesh Kulkarni" or "DOC-1051")' },
          phone: { type: 'string', description: 'New mobile or phone number' },
          specialty: { type: 'string', description: 'New medical specialty' },
          qualification: { type: 'string', description: 'New qualification (e.g. MBBS, MD)' },
          classification: { type: 'string', enum: ['A_PLUS', 'A', 'B', 'C', 'D'], description: 'Doctor grade/classification' },
          headquarterName: { type: 'string', description: 'New territory/headquarter name to transfer doctor' },
          city: { type: 'string', description: 'New clinic city' },
        },
        required: ['doctorNameOrCode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_doctor',
      description: 'Deactivate / soft-delete a doctor from the system.',
      parameters: {
        type: 'object',
        properties: {
          doctorNameOrCode: { type: 'string', description: 'Doctor name or code to deactivate' },
          reason: { type: 'string', description: 'Reason for deactivation' },
        },
        required: ['doctorNameOrCode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_doctor_details',
      description: 'Get full profile and details of a single doctor by name or doctor code.',
      parameters: {
        type: 'object',
        properties: {
          doctorNameOrCode: { type: 'string', description: 'Doctor name or code' },
        },
        required: ['doctorNameOrCode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_product',
      description: 'Add a new pharmaceutical product / medicine to the product catalog.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Brand name of product (e.g. "Biocros-500", "Calci-D3")' },
          composition: { type: 'string', description: 'Active pharmaceutical composition/formulation' },
          mrp: { type: 'number', description: 'Maximum Retail Price in INR' },
          ptr: { type: 'number', description: 'Price to Retailer in INR' },
          category: { type: 'string', description: 'Dosage form / category (e.g. Tablet, Capsule, Syrup, Sachet, Injection)' },
          speciality: { type: 'string', description: 'Target specialty (e.g. Cardiology, Gynecology, Pediatrics)' },
          packSize: { type: 'string', description: 'Packing details (e.g. 10x10 Tablets, 200ml Bottle)' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search and list pharmaceutical products from catalog by name, composition, or category.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Product brand name or composition keyword' },
          category: { type: 'string', description: 'Product category (Tablet, Syrup, Sachet, etc.)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_product',
      description: 'Update price (MRP/PTR), composition, or status of an existing product.',
      parameters: {
        type: 'object',
        properties: {
          productNameOrCode: { type: 'string', description: 'Product name or code to update' },
          mrp: { type: 'number', description: 'New MRP in INR' },
          ptr: { type: 'number', description: 'New PTR in INR' },
          composition: { type: 'string', description: 'Updated composition' },
          isActive: { type: 'boolean', description: 'Whether product is active or discontinued' },
        },
        required: ['productNameOrCode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_employee',
      description: 'Register / onboard a new field workforce employee (MR, ASM, RSM) into the system.',
      parameters: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'First name of the employee' },
          lastName: { type: 'string', description: 'Last name of the employee' },
          role: { type: 'string', enum: ['MR', 'ASM', 'RSM', 'TRADE_REP', 'DISTRIBUTOR_REP'], description: 'Job role' },
          headquarterName: { type: 'string', description: 'Assigned headquarter/territory (e.g. Indore, Nagpur, Bhopal)' },
          email: { type: 'string', description: 'Login email (optional, auto-generated if blank)' },
          phone: { type: 'string', description: 'Mobile contact number' },
        },
        required: ['firstName', 'lastName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_employee',
      description: 'Update employee details (reassign territory/HQ, phone, role, or active status).',
      parameters: {
        type: 'object',
        properties: {
          mrNameOrCode: { type: 'string', description: 'Employee name or code (e.g. "Rahul", "EMP005")' },
          headquarterName: { type: 'string', description: 'New headquarter to reassign' },
          phone: { type: 'string', description: 'New mobile number' },
          role: { type: 'string', enum: ['MR', 'ASM', 'RSM', 'TRADE_REP'], description: 'Updated role' },
          isActive: { type: 'boolean', description: 'Whether account is active' },
        },
        required: ['mrNameOrCode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_retailer',
      description: 'Add a new pharmacy / chemist / retailer shop in a territory.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Chemist or Medical store name (e.g. "Sharma Medicos")' },
          ownerName: { type: 'string', description: 'Pharmacist or proprietor name' },
          phone: { type: 'string', description: 'Contact phone number' },
          headquarterName: { type: 'string', description: 'Headquarter / territory' },
          city: { type: 'string', description: 'City name' },
          category: { type: 'string', enum: ['A', 'B', 'C'], description: 'Category grade' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_retailers',
      description: 'Search chemists and retail pharmacies in a territory or by name.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Chemist name or search keyword' },
          headquarterName: { type: 'string', description: 'Headquarter filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assign_visit',
      description: 'Assign or schedule a field visit call for an MR to see a doctor or chemist on a date.',
      parameters: {
        type: 'object',
        properties: {
          mrName: { type: 'string', description: 'Name of the MR to assign call to' },
          targetName: { type: 'string', description: 'Name of doctor or chemist to visit' },
          date: { type: 'string', description: 'Target date in YYYY-MM-DD format (defaults to today)' },
          visitType: { type: 'string', enum: ['DOCTOR', 'RETAILER', 'HOSPITAL'], description: 'Type of visit' },
        },
        required: ['mrName', 'targetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_orders_summary',
      description: 'Get secondary sales and orders telemetry (total revenue, order count, top retailers).',
      parameters: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['today', 'this_month', 'all'], description: 'Time range for orders' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_approvals',
      description: 'Get list of pending approvals (doctors approval, leave applications, expense claims).',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['all', 'doctors', 'leaves', 'expenses'], description: 'Type of approval items' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_or_reject_request',
      description: 'Approve or reject a pending doctor addition, leave request, or expense claim.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['doctor', 'leave', 'expense'], description: 'Target entity type' },
          targetNameOrId: { type: 'string', description: 'Name of doctor, MR, or ID of request' },
          action: { type: 'string', enum: ['APPROVE', 'REJECT'], description: 'Approval decision' },
          remarks: { type: 'string', description: 'Optional approval or rejection remarks' },
        },
        required: ['type', 'targetNameOrId', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_headquarter',
      description: 'Add or create a new headquarter / territory location for operations.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the Headquarter/Territory (e.g. "Raipur", "Bhopal", "Jabalpur")' },
          state: { type: 'string', description: 'State (e.g. "Madhya Pradesh", "Maharashtra", "Chhattisgarh")' },
          district: { type: 'string', description: 'District name' },
          code: { type: 'string', description: 'Optional unique HQ code' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_headquarters',
      description: 'List all active operating headquarters / territories.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional filter by HQ name or state' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_hospital',
      description: 'Add a new hospital or medical center / clinic to the directory.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Hospital / Clinic name' },
          headquarterName: { type: 'string', description: 'Assigned headquarter/territory' },
          city: { type: 'string', description: 'City name' },
          beds: { type: 'number', description: 'Approximate bed count' },
          category: { type: 'string', description: 'Category (e.g. Multi-specialty, Super-specialty, Nursing Home)' },
          type: { type: 'string', enum: ['private', 'govt', 'trust'], description: 'Hospital ownership type' },
          phone: { type: 'string', description: 'Hospital contact telephone number' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_hospitals',
      description: 'Search registered hospitals and medical clinics.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Hospital name or keyword' },
          headquarterName: { type: 'string', description: 'Headquarter filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_stockist',
      description: 'Add a new wholesale stockist or distributor to the network.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Stockist firm / agency name' },
          headquarterName: { type: 'string', description: 'Assigned headquarter' },
          city: { type: 'string', description: 'City name' },
          mobileNumber: { type: 'string', description: 'Contact mobile number' },
          gstinNumber: { type: 'string', description: 'GSTIN number' },
          contactPerson: { type: 'string', description: 'Owner or key contact person name' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_stockists',
      description: 'Search wholesale stockists and distributors in the network.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Stockist agency name' },
          headquarterName: { type: 'string', description: 'Headquarter filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attendance_summary',
      description: 'Get today\'s live field force attendance summary (who is Present, Checked-in, Absent, or On Leave).',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_scheme',
      description: 'Create a new trade scheme or sales offer (e.g. 10+1 free, 5% cash discount).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Scheme title (e.g. "Monsoon Special 10+1", "Secondary 5% Discount")' },
          description: { type: 'string', description: 'Scheme details' },
          discountType: { type: 'string', enum: ['PERCENTAGE', 'FLAT', 'FREE_ITEM'], description: 'Type of discount' },
          discountValue: { type: 'number', description: 'Discount percentage or flat amount' },
          minQuantity: { type: 'number', description: 'Minimum order quantity required' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_schemes',
      description: 'List active trade schemes, promotional offers, and discounts.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional keyword filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sample_distribution',
      description: 'View pharmaceutical medicine samples and promotional inputs given to doctors by MRs.',
      parameters: {
        type: 'object',
        properties: {
          doctorName: { type: 'string', description: 'Doctor name filter' },
          mrName: { type: 'string', description: 'MR representative filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tour_plans',
      description: 'View Monthly Tour Programs (MTP) / tour plans submitted by field MRs.',
      parameters: {
        type: 'object',
        properties: {
          mrName: { type: 'string', description: 'MR name' },
          month: { type: 'string', description: 'Month in YYYY-MM format' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_tour_plan',
      description: 'Approve or reject a submitted tour plan / Monthly Tour Program for an MR.',
      parameters: {
        type: 'object',
        properties: {
          mrNameOrPlanId: { type: 'string', description: 'MR name or Tour Plan ID' },
          action: { type: 'string', enum: ['APPROVE', 'REJECT'], description: 'Decision' },
        },
        required: ['mrNameOrPlanId', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_team_broadcast',
      description: 'Send broadcast announcement or high-priority notice to all active field representatives.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Announcement title' },
          message: { type: 'string', description: 'Message body content' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_sales_target',
      description: 'Set annual or monthly sales target for a headquarter / territory.',
      parameters: {
        type: 'object',
        properties: {
          headquarterName: { type: 'string', description: 'Target headquarter / territory' },
          targetAmount: { type: 'number', description: 'Target amount in INR' },
          year: { type: 'number', description: 'Target year (e.g. 2026)' },
        },
        required: ['headquarterName', 'targetAmount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_targets_summary',
      description: 'View sales targets and allocation across operating territories.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number', description: 'Target year' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_expenses_summary',
      description: 'Get field expenses telemetry (Travel Allowance, Daily Allowance, total claims today/month).',
      parameters: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['today', 'this_month', 'all'], description: 'Timeframe for expenses' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Create and assign a task / to-do item for a field representative.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title / description' },
          mrName: { type: 'string', description: 'Name of the representative to assign' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], description: 'Priority level' },
          dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_to_page',
      description: 'Generate navigation link to a specific section of the Pharmax portal.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: ['doctors', 'visits_monitor', 'visits_directory', 'calendar', 'employees', 'reports', 'attendance', 'orders', 'hospitals', 'stockists', 'schemes', 'samples', 'tourplans', 'targets', 'expenses', 'tasks'],
            description: 'Destination page inside admin portal',
          },
        },
        required: ['page'],
      },
    },
  },
];

// ── Smart Representative Search Helper ────────────────────────────────────────
async function findRepByName(query: string) {
  const clean = (query || '').trim().replace(/^(mr|rep|dr|sales)\s+/i, '').trim();
  if (!clean || ['all', 'sab', 'everyone', 'team', 'mr', 'today'].includes(clean.toLowerCase())) return null;

  // 1. Direct contains check
  let rep = await prisma.user.findFirst({
    where: {
      OR: [
        { firstName: { contains: clean, mode: 'insensitive' } },
        { lastName: { contains: clean, mode: 'insensitive' } },
        { employeeId: { contains: clean, mode: 'insensitive' } },
      ],
      role: { in: ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP', 'ASM', 'RSM'] },
    },
    include: { hq: true },
  });
  if (rep) return rep;

  // 2. Tokenize by space (e.g. "jaya bhandakkar" -> tokens: ["jaya", "bhandakkar"])
  const tokens = clean.split(/\s+/).filter(t => t.length >= 3);
  for (const token of tokens) {
    rep = await prisma.user.findFirst({
      where: {
        OR: [
          { firstName: { contains: token, mode: 'insensitive' } },
          { lastName: { contains: token, mode: 'insensitive' } },
        ],
        role: { in: ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP', 'ASM', 'RSM'] },
      },
      include: { hq: true },
    });
    if (rep) return rep;
  }

  // 3. Fuzzy search across full names of field reps
  const allReps = await prisma.user.findMany({
    where: { role: { in: ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP', 'ASM', 'RSM'] } },
    include: { hq: true },
  });

  const matched = allReps.find(r => {
    const full = `${r.firstName} ${r.lastName}`.toLowerCase();
    return tokens.some(t => full.includes(t.toLowerCase())) || full.includes(clean.toLowerCase());
  });

  return matched || null;
}

// ── Smart Doctor Search Helper ────────────────────────────────────────────────
async function findDoctorByName(query: string) {
  const clean = (query || '').trim().replace(/^(dr|doctor|prof)\.?\s+/i, '').trim();
  if (!clean) return null;

  // 1. Direct contains check
  let doc = await prisma.doctor.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { doctorCode: { equals: clean, mode: 'insensitive' } },
        { firstName: { contains: clean, mode: 'insensitive' } },
        { lastName: { contains: clean, mode: 'insensitive' } },
      ],
    },
    include: { hq: true },
  });
  if (doc) return doc;

  // 2. Tokenize by space
  const tokens = clean.split(/\s+/).filter(t => t.length >= 3);
  for (const token of tokens) {
    doc = await prisma.doctor.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: token, mode: 'insensitive' } },
          { lastName: { contains: token, mode: 'insensitive' } },
        ],
      },
      include: { hq: true },
    });
    if (doc) return doc;
  }

  return null;
}

// ── Tool Execution Implementations ───────────────────────────────────────────
async function executeTool(name: string, args: any, adminUser: { id: string; role: string }): Promise<AgentActionResult> {
  switch (name) {
    case 'add_doctor': {
      let hqId: string | undefined;
      let hqName = args.headquarterName;

      if (hqName) {
        const foundHq = await prisma.territory.findFirst({
          where: { name: { contains: hqName.trim(), mode: 'insensitive' } },
        });
        if (foundHq) {
          hqId = foundHq.id;
          hqName = foundHq.name;
        }
      }

      // If no HQ specified, find first default territory
      if (!hqId) {
        const defaultHq = await prisma.territory.findFirst();
        if (defaultHq) {
          hqId = defaultHq.id;
          hqName = defaultHq.name;
        }
      }

      const totalDocs = await prisma.doctor.count();
      const doctorCode = `DOC-${String(totalDocs + 1001).padStart(4, '0')}`;

      const newDoctor = await prisma.doctor.create({
        data: {
          doctorCode,
          salutation: args.salutation || 'Dr.',
          firstName: (args.firstName || 'Doctor').trim(),
          lastName: (args.lastName || '').trim(),
          specialty: (args.specialty || 'General Medicine').trim(),
          qualification: (args.qualification || 'MBBS').trim(),
          phone: args.phone || undefined,
          city: args.city || hqName || 'General',
          hqId: hqId || undefined,
          territoryId: hqId || undefined,
          category: args.category || 'Specialist',
          classification: 'B',
          approvalStatus: 'APPROVED',
          isActive: true,
        },
        include: { hq: true },
      });

      const fullName = `${newDoctor.salutation || 'Dr.'} ${newDoctor.firstName} ${newDoctor.lastName}`.trim();

      return {
        actionType: 'DOCTOR_CREATED',
        title: 'New Doctor Registered',
        data: {
          id: newDoctor.id,
          doctorCode: newDoctor.doctorCode,
          name: fullName,
          specialty: newDoctor.specialty,
          qualification: newDoctor.qualification,
          hqName: newDoctor.hq?.name || hqName || 'Assigned HQ',
          phone: newDoctor.phone || 'N/A',
          city: newDoctor.city,
        },
        message: `Successfully registered ${fullName} (${newDoctor.specialty}, ${newDoctor.qualification}) under ${newDoctor.hq?.name || 'territory'}.`,
        link: `/dashboard/doctors/${newDoctor.id}`,
      };
    }

    case 'get_team_activity_report': {
      const targetDate = args.date ? new Date(args.date) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      const dateStr = targetDate.toISOString().slice(0, 10);

      const reps = await prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP', 'ASM'] },
        },
        include: { hq: true },
        orderBy: { firstName: 'asc' },
      });

      const repStats = await Promise.all(
        reps.map(async (rep) => {
          const visits = await prisma.visit.findMany({
            where: {
              userId: rep.id,
              plannedDate: { gte: startOfDay, lte: endOfDay },
            },
            select: { status: true },
          });

          const total = visits.length;
          const completed = visits.filter(v => v.status === 'COMPLETED' || v.status === 'REPORTED').length;
          const live = visits.filter(v => ['CHECKED_IN', 'PREPARING', 'ENGAGING', 'DETAILING'].includes(v.status)).length;

          return {
            id: rep.id,
            name: `${rep.firstName} ${rep.lastName}`,
            role: rep.role,
            hq: rep.hq?.name || 'HQ',
            total,
            completed,
            live,
          };
        })
      );

      const totalCalls = repStats.reduce((acc, r) => acc + r.total, 0);
      const totalCompleted = repStats.reduce((acc, r) => acc + r.completed, 0);
      const totalLive = repStats.reduce((acc, r) => acc + r.live, 0);

      const summaryList = repStats
        .map((r, i) => `${i + 1}. **${r.name}** (${r.hq}): ${r.total} visits (${r.completed} Completed, ${r.live} Live)`)
        .join('\n');

      return {
        actionType: 'REP_LIST',
        title: `Team Daily Activity Report (${reps.length} Representatives)`,
        data: {
          date: dateStr,
          totalReps: reps.length,
          totalCalls,
          totalCompleted,
          totalLive,
          representatives: repStats,
        },
        message: `आज की फील्ड रिपोर्ट:\nकुल **${reps.length} फ़ील्ड प्रतिनिधि**, **${totalCalls} विज़िट्स** शेड्यूल्ड, **${totalCompleted} पूर्ण**, **${totalLive} क्लिनिक में चालू**।\n\n${summaryList}`,
        link: `/dashboard/visits/monitor`,
      };
    }

    case 'get_mr_activity_report': {
      const rawName = (args.mrName || '').trim();

      // If user requested all / general query, delegate to team report
      if (!rawName || ['all', 'sab', 'team', 'everyone', 'mr', 'today'].includes(rawName.toLowerCase())) {
        return await executeTool('get_team_activity_report', args, adminUser);
      }

      const rep = await findRepByName(rawName);

      if (!rep) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: { query: rawName },
          message: `प्रतिनिधि "${rawName}" नहीं मिला। कृपया सही नाम जांचें (जैसे Ashish Shrivas, Jaya Wandhare, Santosh Telang, Sameer Khan)।`,
        };
      }

      const targetDate = args.date ? new Date(args.date) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const visits = await prisma.visit.findMany({
        where: {
          userId: rep.id,
          plannedDate: { gte: startOfDay, lte: endOfDay },
        },
        include: {
          doctor: { select: { firstName: true, lastName: true, specialty: true } },
          retailer: { select: { name: true } },
          hospital: { select: { name: true } },
        },
        orderBy: { plannedDate: 'asc' },
      });

      const total = visits.length;
      const completed = visits.filter(v => v.status === 'COMPLETED' || v.status === 'REPORTED').length;
      const live = visits.filter(v => ['CHECKED_IN', 'PREPARING', 'ENGAGING', 'DETAILING'].includes(v.status)).length;
      const cancelled = visits.filter(v => v.status === 'CANCELLED').length;
      const planned = visits.filter(v => v.status === 'PLANNED').length;

      // Calculate total POB orders booked today by this MR
      const orders = await prisma.order.findMany({
        where: {
          userId: rep.id,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        select: { totalAmount: true },
      });
      const totalPob = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);

      const repName = `${rep.firstName} ${rep.lastName}`;
      const dateStr = targetDate.toISOString().slice(0, 10);

      return {
        actionType: 'MR_REPORT',
        title: `Field Report: ${repName}`,
        data: {
          mr: {
            id: rep.id,
            name: repName,
            role: rep.role,
            hq: rep.hq?.name || 'Headquarter',
            employeeId: rep.employeeId,
          },
          date: dateStr,
          stats: {
            total,
            completed,
            live,
            cancelled,
            planned,
            totalPob,
          },
          callsPreview: visits.slice(0, 6).map(v => ({
            id: v.id,
            target: v.doctor ? `Dr. ${v.doctor.firstName} ${v.doctor.lastName}` : v.retailer?.name || v.hospital?.name || 'Call',
            status: v.status,
          })),
        },
        message: `${repName} की आज ${dateStr} को कुल ${total} विज़िट्स शेड्यूल हैं (${completed} पूर्ण, ${live} क्लिनिक में चालू, ${planned} बाकी)। बुक किया गया POB: ₹${totalPob}।`,
        link: `/dashboard/visits/monitor?repId=${rep.id}&date=${dateStr}`,
      };
    }

    case 'bulk_cancel_visits': {
      const rep = await findRepByName(args.mrName);

      if (!rep) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: { query: args.mrName },
          message: `विज़िट्स रद्द करने के लिए प्रतिनिधि "${args.mrName}" नहीं मिला।`,
        };
      }

      const targetDate = args.date || new Date().toISOString().slice(0, 10);
      const reason = args.reason || 'Wrong territory/route planned - Bulk cancelled by AI Copilot';

      const result = await visitService.bulkCancel(adminUser.id, adminUser.role, {
        mrUserId: rep.id,
        date: targetDate,
        reason,
        includeActive: !!args.includeActive,
      });

      const repName = `${rep.firstName} ${rep.lastName}`;

      return {
        actionType: 'VISITS_CANCELLED',
        title: 'Visits Bulk Cancelled',
        data: {
          repName,
          date: targetDate,
          count: result.count,
          reason,
        },
        message: result.count > 0
          ? `Successfully cancelled ${result.count} planned visits for ${repName} on ${targetDate}. Reason: "${reason}".`
          : `No cancellable planned visits found for ${repName} on ${targetDate}.`,
        link: `/dashboard/visits/monitor?repId=${rep.id}`,
      };
    }

    case 'get_headquarter_doctors_count': {
      const rawHq = (args.headquarterName || '').trim();
      let territory: any = null;

      if (rawHq) {
        territory = await prisma.territory.findFirst({
          where: { name: { contains: rawHq, mode: 'insensitive' } },
        });
      }

      if (rawHq) {
        const whereCondition: Prisma.DoctorWhereInput = {
          deletedAt: null,
          isActive: true,
          OR: [
            ...(territory ? [{ hqId: territory.id }, { territoryId: territory.id }] : []),
            { city: { contains: rawHq, mode: 'insensitive' } },
          ],
        };

        const [totalCount, specialties, sampleDoctors] = await Promise.all([
          prisma.doctor.count({ where: whereCondition }),
          prisma.doctor.groupBy({
            by: ['specialty'],
            where: whereCondition,
            _count: { specialty: true },
            orderBy: { _count: { specialty: 'desc' } },
            take: 6,
          }),
          prisma.doctor.findMany({
            where: whereCondition,
            select: { id: true, salutation: true, firstName: true, lastName: true, specialty: true, qualification: true, phone: true, city: true },
            take: 5,
          }),
        ]);

        const resolvedHq = territory?.name || rawHq;
        const specialtySummary = specialties.map(s => `${s.specialty || 'General'}: ${s._count.specialty}`).join(', ');

        return {
          actionType: 'DOCTOR_SEARCH',
          title: `${resolvedHq} Headquarter - ${totalCount} Doctors`,
          data: {
            headquarter: resolvedHq,
            totalDoctors: totalCount,
            topSpecialties: specialties.map(s => ({ specialty: s.specialty || 'General', count: s._count.specialty })),
            doctors: sampleDoctors.map(d => ({
              id: d.id,
              name: `${d.salutation || 'Dr.'} ${d.firstName} ${d.lastName}`.trim(),
              specialty: d.specialty,
              qualification: d.qualification,
              hq: resolvedHq,
              phone: d.phone,
            })),
          },
          message: `📍 **${resolvedHq} हेडक्वार्टर** में कुल **${totalCount} डॉक्टर्स** रजिस्टर्ड हैं।\n\n**प्रमुख स्पेशियलिटीज:**\n${specialtySummary || 'विवरण उपलब्ध नहीं'}`,
          link: `/dashboard/doctors?search=${encodeURIComponent(resolvedHq)}`,
        };
      } else {
        // All headquarters summary
        const territories = await prisma.territory.findMany({ select: { id: true, name: true } });
        const hqCounts = await Promise.all(
          territories.map(async t => ({
            name: t.name,
            count: await prisma.doctor.count({
              where: {
                deletedAt: null,
                OR: [{ hqId: t.id }, { territoryId: t.id }, { city: { contains: t.name, mode: 'insensitive' } }],
              },
            }),
          }))
        );

        const totalAll = await prisma.doctor.count({ where: { deletedAt: null } });
        const breakdown = hqCounts.map(h => `• **${h.name}:** ${h.count} डॉक्टर्स`).join('\n');

        return {
          actionType: 'DOCTOR_SEARCH',
          title: `All Headquarters - ${totalAll} Total Doctors`,
          data: {
            totalDoctors: totalAll,
            headquarters: hqCounts,
          },
          message: `पोर्टल में कुल **${totalAll} डॉक्टर्स** रजिस्टर्ड हैं।\n\n**हेडक्वार्टर अनुसार विवरण:**\n${breakdown}`,
          link: `/dashboard/doctors`,
        };
      }
    }

    case 'search_doctors': {
      const q = (args.query || '').trim();
      const hq = (args.headquarterName || '').trim();

      const conditions: Prisma.DoctorWhereInput[] = [{ deletedAt: null }];

      if (q) {
        conditions.push({
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { specialty: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
          ],
        });
      }

      if (hq) {
        conditions.push({
          OR: [
            { hq: { name: { contains: hq, mode: 'insensitive' } } },
            { city: { contains: hq, mode: 'insensitive' } },
          ],
        });
      }

      const doctors = await prisma.doctor.findMany({
        where: { AND: conditions },
        include: { hq: true },
        take: 8,
      });

      const totalCount = await prisma.doctor.count({
        where: { AND: conditions },
      });

      return {
        actionType: 'DOCTOR_SEARCH',
        title: `Doctor Search Results (${totalCount})`,
        data: {
          query: q || hq,
          totalCount,
          doctors: doctors.map(d => ({
            id: d.id,
            name: `${d.salutation || 'Dr.'} ${d.firstName} ${d.lastName}`,
            specialty: d.specialty,
            qualification: d.qualification,
            hq: d.hq?.name || d.city || 'Territory',
            phone: d.phone,
          })),
        },
        message: totalCount > 0
          ? `कुल ${totalCount} डॉक्टर्स मिले ${hq ? `(${hq} हेडक्वार्टर में)` : ''}।`
          : `कोई डॉक्टर नहीं मिला "${q || hq}" के लिए। क्या आप नया डॉक्टर ऐड करना चाहते हैं?`,
        link: `/dashboard/doctors?search=${encodeURIComponent(q || hq)}`,
      };
    }

    case 'list_field_representatives': {
      const reps = await prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP', 'ASM'] },
        },
        include: { hq: true },
        take: 12,
        orderBy: { firstName: 'asc' },
      });

      return {
        actionType: 'REP_LIST',
        title: `Field Representatives (${reps.length})`,
        data: {
          representatives: reps.map(r => ({
            id: r.id,
            name: `${r.firstName} ${r.lastName}`,
            role: r.role,
            hq: r.hq?.name || 'Unassigned HQ',
            code: r.employeeId,
          })),
        },
        message: `Currently tracking ${reps.length} active field representatives across territories.`,
        link: `/dashboard/workforce`,
      };
    }

    case 'get_dashboard_summary': {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [totalVisits, completedVisits, liveVisits, totalDoctors] = await Promise.all([
        prisma.visit.count({ where: { plannedDate: { gte: today, lt: tomorrow } } }),
        prisma.visit.count({ where: { plannedDate: { gte: today, lt: tomorrow }, status: { in: ['COMPLETED', 'REPORTED'] } } }),
        prisma.visit.count({ where: { plannedDate: { gte: today, lt: tomorrow }, status: { in: ['CHECKED_IN', 'PREPARING', 'ENGAGING', 'DETAILING'] } } }),
        prisma.doctor.count({ where: { deletedAt: null, isActive: true } }),
      ]);

      return {
        actionType: 'DASHBOARD_STATS',
        title: "Today's Field Telemetry Overview",
        data: {
          totalVisits,
          completedVisits,
          liveVisits,
          totalDoctors,
        },
        message: `Today: ${totalVisits} total field calls scheduled, ${completedVisits} completed, ${liveVisits} reps actively inside clinics. Total registered doctors: ${totalDoctors}.`,
        link: `/dashboard/visits/monitor`,
      };
    }

    case 'navigate_to_page': {
      const PAGE_MAP: Record<string, { title: string; url: string }> = {
        doctors: { title: 'Doctors Directory', url: '/dashboard/doctors' },
        visits_monitor: { title: 'Live Field Operations Monitor', url: '/dashboard/visits/monitor' },
        visits_directory: { title: 'Visits Directory', url: '/dashboard/visits' },
        calendar: { title: 'Field Calendar', url: '/dashboard/calendar' },
        employees: { title: 'Workforce Directory', url: '/dashboard/workforce' },
        reports: { title: 'Reports & Analytics', url: '/dashboard/reports' },
        attendance: { title: 'Attendance Log', url: '/dashboard/attendance' },
        orders: { title: 'Orders & Secondary Sales', url: '/dashboard/orders' },
        hospitals: { title: 'Hospitals Directory', url: '/dashboard/hospitals' },
        stockists: { title: 'Stockists Directory', url: '/dashboard/stockists' },
        schemes: { title: 'Trade Schemes & Promotions', url: '/dashboard/schemes' },
        samples: { title: 'Sample Management', url: '/dashboard/samples' },
        tourplans: { title: 'Tour Programs (MTP)', url: '/dashboard/tourplans' },
        targets: { title: 'Sales Targets', url: '/dashboard/targets' },
        expenses: { title: 'Expense Claims', url: '/dashboard/expenses' },
        tasks: { title: 'Tasks Management', url: '/dashboard/tasks' },
      };

      const target = PAGE_MAP[args.page] || PAGE_MAP.doctors;

      return {
        actionType: 'NAVIGATION',
        title: target.title,
        data: { url: target.url },
        message: `Click below to navigate directly to ${target.title}.`,
        link: target.url,
      };
    }

    case 'update_doctor': {
      const doc = await findDoctorByName(args.doctorNameOrCode);
      if (!doc) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: {},
          message: `डॉक्टर "${args.doctorNameOrCode}" डेटाबेस में नहीं मिले। कृपया डॉक्टर का सही नाम या कोड जांचें।`,
        };
      }

      let hqId = doc.hqId;
      if (args.headquarterName) {
        const foundHq = await prisma.territory.findFirst({
          where: { name: { contains: args.headquarterName.trim(), mode: 'insensitive' } },
        });
        if (foundHq) hqId = foundHq.id;
      }

      const updated = await prisma.doctor.update({
        where: { id: doc.id },
        data: {
          phone: args.phone !== undefined ? args.phone : doc.phone,
          specialty: args.specialty ? args.specialty.trim() : doc.specialty,
          qualification: args.qualification ? args.qualification.trim() : doc.qualification,
          classification: args.classification ? args.classification : doc.classification,
          city: args.city ? args.city.trim() : doc.city,
          hqId,
          territoryId: hqId,
        },
        include: { hq: true },
      });

      const docName = `${updated.salutation || 'Dr.'} ${updated.firstName} ${updated.lastName}`.trim();

      return {
        actionType: 'DOCTOR_UPDATED',
        title: `Doctor Profile Updated: ${docName}`,
        data: {
          id: updated.id,
          doctorCode: updated.doctorCode,
          name: docName,
          specialty: updated.specialty,
          qualification: updated.qualification,
          phone: updated.phone || 'N/A',
          hq: updated.hq?.name || 'Assigned HQ',
          classification: updated.classification,
        },
        message: `डॉक्टर **${docName}** का विवरण सफलतापूर्वक अपडेट कर दिया गया है। (Specialty: ${updated.specialty}, HQ: ${updated.hq?.name || 'Assigned'}, Phone: ${updated.phone || 'N/A'})।`,
        link: `/dashboard/doctors/${updated.id}`,
      };
    }

    case 'delete_doctor': {
      const doc = await findDoctorByName(args.doctorNameOrCode);
      if (!doc) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: {},
          message: `डॉक्टर "${args.doctorNameOrCode}" नहीं मिले।`,
        };
      }

      await prisma.doctor.update({
        where: { id: doc.id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      const docName = `${doc.salutation || 'Dr.'} ${doc.firstName} ${doc.lastName}`.trim();

      return {
        actionType: 'DOCTOR_DEACTIVATED',
        title: `Doctor Deactivated: ${docName}`,
        data: {
          id: doc.id,
          doctorCode: doc.doctorCode,
          name: docName,
          reason: args.reason || 'Deactivated by Super Admin via Copilot',
        },
        message: `डॉक्टर **${docName}** (${doc.doctorCode}) को सफलतापूर्वक निष्क्रिय (Deactivate/Delete) कर दिया गया है।`,
        link: `/dashboard/doctors`,
      };
    }

    case 'get_doctor_details': {
      const doc = await findDoctorByName(args.doctorNameOrCode);
      if (!doc) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: {},
          message: `डॉक्टर "${args.doctorNameOrCode}" नहीं मिले।`,
        };
      }

      const visitsCount = await prisma.visit.count({ where: { doctorId: doc.id } });
      const docName = `${doc.salutation || 'Dr.'} ${doc.firstName} ${doc.lastName}`.trim();

      return {
        actionType: 'DOCTOR_SEARCH',
        title: `Doctor Profile: ${docName}`,
        data: {
          id: doc.id,
          name: docName,
          doctorCode: doc.doctorCode,
          specialty: doc.specialty,
          qualification: doc.qualification,
          hq: doc.hq?.name || doc.city || 'HQ',
          phone: doc.phone || 'N/A',
          city: doc.city,
          classification: doc.classification,
          visitsCount,
        },
        message: `**${docName}** (${doc.doctorCode})\n• स्पेशियलिटी: ${doc.specialty} (${doc.qualification})\n• मुख्यालय: ${doc.hq?.name || doc.city || 'HQ'}\n• फोन: ${doc.phone || 'N/A'}\n• कुल विज़िट्स: ${visitsCount}`,
        link: `/dashboard/doctors/${doc.id}`,
      };
    }

    case 'add_product': {
      const count = await prisma.product.count();
      const productCode = `PRD-${String(count + 101).padStart(4, '0')}`;
      const productName = (args.name || args.productName || 'New Product').trim();
      const mrpValue = args.mrp ? Number(args.mrp) : 100;
      const ptrValue = args.ptr ? Number(args.ptr) : mrpValue * 0.75;
      const ptsValue = args.pts ? Number(args.pts) : ptrValue * 0.85;

      const newProduct = await prisma.product.create({
        data: {
          productCode,
          name: productName,
          composition: args.composition || 'Standard Pharma Formulation',
          category: args.category || 'General',
          speciality: args.speciality || 'General Medicine',
          mrp: mrpValue,
          ptr: ptrValue,
          pts: ptsValue,
          unit: args.packSize || '10x10 Tablets',
          code: productCode,
          isActive: true,
        },
      });

      return {
        actionType: 'PRODUCT_CREATED',
        title: `New Product Added: ${newProduct.name}`,
        data: {
          id: newProduct.id,
          productCode: newProduct.productCode,
          name: newProduct.name,
          composition: newProduct.composition,
          mrp: newProduct.mrp,
          ptr: newProduct.ptr,
          category: newProduct.category,
        },
        message: `नया प्रोडक्ट **${newProduct.name}** (Code: ${newProduct.productCode}, MRP: ₹${newProduct.mrp}, Composition: ${newProduct.composition}) सफलतापूर्वक प्रोडक्ट कैटलॉग में जोड़ दिया गया है।`,
        link: `/dashboard/products`,
      };
    }

    case 'search_products': {
      const q = (args.query || '').trim();
      const cat = (args.category || '').trim();

      const conditions: Prisma.ProductWhereInput[] = [{ isActive: true }];
      if (q) {
        conditions.push({
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { composition: { contains: q, mode: 'insensitive' } },
            { productCode: { contains: q, mode: 'insensitive' } },
          ],
        });
      }
      if (cat) {
        conditions.push({ category: { contains: cat, mode: 'insensitive' } });
      }

      const products = await prisma.product.findMany({
        where: { AND: conditions },
        take: 8,
        orderBy: { name: 'asc' },
      });

      const total = await prisma.product.count({ where: { AND: conditions } });

      return {
        actionType: 'PRODUCT_LIST',
        title: `Products Found (${total})`,
        data: {
          query: q || cat,
          total,
          products: products.map(p => ({
            id: p.id,
            code: p.productCode,
            name: p.name,
            composition: p.composition,
            mrp: p.mrp,
            ptr: p.ptr,
            category: p.category,
          })),
        },
        message: `कुल **${total} प्रोडक्ट्स** मिले।\n` + products.slice(0, 5).map(p => `• **${p.name}** - ₹${p.mrp} (${p.category || 'Pharma'})`).join('\n'),
        link: `/dashboard/products`,
      };
    }

    case 'update_product': {
      const q = (args.productNameOrCode || '').trim();
      const prod = await prisma.product.findFirst({
        where: {
          OR: [
            { productCode: { equals: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
      });

      if (!prod) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: {},
          message: `प्रोडक्ट "${q}" नहीं मिला।`,
        };
      }

      const updated = await prisma.product.update({
        where: { id: prod.id },
        data: {
          mrp: args.mrp !== undefined ? Number(args.mrp) : prod.mrp,
          ptr: args.ptr !== undefined ? Number(args.ptr) : prod.ptr,
          composition: args.composition || prod.composition,
          isActive: args.isActive !== undefined ? Boolean(args.isActive) : prod.isActive,
        },
      });

      return {
        actionType: 'PRODUCT_UPDATED',
        title: `Product Updated: ${updated.name}`,
        data: {
          id: updated.id,
          name: updated.name,
          productCode: updated.productCode,
          mrp: updated.mrp,
          ptr: updated.ptr,
          isActive: updated.isActive,
        },
        message: `प्रोडक्ट **${updated.name}** का मूल्य/विवरण अपडेट कर दिया गया है। (MRP: ₹${updated.mrp}, PTR: ₹${updated.ptr})।`,
        link: `/dashboard/products`,
      };
    }

    case 'add_employee': {
      const firstName = args.firstName.trim();
      const lastName = args.lastName.trim();
      const role = args.role || 'MR';

      let hqId: string | undefined;
      let hqName = args.headquarterName;

      if (hqName) {
        const foundHq = await prisma.territory.findFirst({
          where: { name: { contains: hqName.trim(), mode: 'insensitive' } },
        });
        if (foundHq) {
          hqId = foundHq.id;
          hqName = foundHq.name;
        }
      }

      const totalUsers = await prisma.user.count();
      const employeeId = `EMP${String(totalUsers + 1).padStart(3, '0')}`;
      const email = args.email?.trim() || `${firstName.toLowerCase()}.${lastName.toLowerCase()}${totalUsers + 1}@pharmax.com`;
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);

      const newUser = await prisma.user.create({
        data: {
          employeeId,
          email,
          passwordHash,
          firstName,
          lastName,
          role: role as any,
          phone: args.phone || undefined,
          hqId,
          isActive: true,
        },
        include: { hq: true },
      });

      return {
        actionType: 'EMPLOYEE_CREATED',
        title: `New Field Representative Created: ${firstName} ${lastName}`,
        data: {
          id: newUser.id,
          employeeId: newUser.employeeId,
          name: `${firstName} ${lastName}`,
          email: newUser.email,
          role: newUser.role,
          hq: newUser.hq?.name || hqName || 'Unassigned HQ',
          defaultPassword: 'password123',
        },
        message: `नया फ़ील्ड कर्मचारी **${firstName} ${lastName}** (${newUser.role}, ${newUser.employeeId}) सफलतापूर्वक जोड़ दिया गया है।\n• लॉगिन ईमेल: ${newUser.email}\n• मुख्यालय: ${newUser.hq?.name || 'Assigned'}\n• डिफ़ॉल्ट पासवर्ड: password123`,
        link: `/dashboard/workforce`,
      };
    }

    case 'update_employee': {
      const rep = await findRepByName(args.mrNameOrCode);
      if (!rep) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: {},
          message: `कर्मचारी/प्रतिनिधि "${args.mrNameOrCode}" नहीं मिला।`,
        };
      }

      let hqId = rep.hqId;
      if (args.headquarterName) {
        const foundHq = await prisma.territory.findFirst({
          where: { name: { contains: args.headquarterName.trim(), mode: 'insensitive' } },
        });
        if (foundHq) hqId = foundHq.id;
      }

      const updated = await prisma.user.update({
        where: { id: rep.id },
        data: {
          phone: args.phone || rep.phone,
          hqId,
          role: args.role ? (args.role as any) : rep.role,
          isActive: args.isActive !== undefined ? Boolean(args.isActive) : rep.isActive,
        },
        include: { hq: true },
      });

      const repName = `${updated.firstName} ${updated.lastName}`;

      return {
        actionType: 'EMPLOYEE_UPDATED',
        title: `Employee Updated: ${repName}`,
        data: {
          id: updated.id,
          name: repName,
          role: updated.role,
          hq: updated.hq?.name || 'HQ',
          phone: updated.phone || 'N/A',
          isActive: updated.isActive,
        },
        message: `कर्मचारी **${repName}** का प्रोफ़ाइल अपडेट कर दिया गया है। (मुख्यालय: ${updated.hq?.name || 'HQ'}, रोल: ${updated.role}, स्थिति: ${updated.isActive ? 'सक्रिय' : 'निष्क्रिय'})।`,
        link: `/dashboard/workforce`,
      };
    }

    case 'add_retailer': {
      let hqId: string | undefined;
      let hqName = args.headquarterName;

      if (hqName) {
        const foundHq = await prisma.territory.findFirst({
          where: { name: { contains: hqName.trim(), mode: 'insensitive' } },
        });
        if (foundHq) {
          hqId = foundHq.id;
          hqName = foundHq.name;
        }
      }

      const count = await prisma.retailer.count();
      const retailerCode = `RET-${String(count + 1001).padStart(4, '0')}`;

      const newRetailer = await prisma.retailer.create({
        data: {
          retailerCode,
          name: (args.name || args.retailerName || args.storeName || 'New Store').trim(),
          ownerName: args.ownerName || undefined,
          phone: args.phone || undefined,
          city: args.city || hqName || 'General',
          hqId,
          territoryId: hqId,
          category: (args.category || 'A') as any,
          approvalStatus: 'APPROVED',
          isActive: true,
        },
        include: { hq: true },
      });

      return {
        actionType: 'RETAILER_CREATED',
        title: `New Chemist / Retailer Added: ${newRetailer.name}`,
        data: {
          id: newRetailer.id,
          code: newRetailer.retailerCode,
          name: newRetailer.name,
          city: newRetailer.city,
          hq: newRetailer.hq?.name || hqName || 'HQ',
          phone: newRetailer.phone || 'N/A',
        },
        message: `नया केमिस्ट/रिटेलर **${newRetailer.name}** (${newRetailer.retailerCode}, ${newRetailer.city}) सफलतापूर्वक जोड़ दिया गया है।`,
        link: `/dashboard/retailers`,
      };
    }

    case 'search_retailers': {
      const q = (args.query || '').trim();
      const hq = (args.headquarterName || '').trim();

      const conditions: Prisma.RetailerWhereInput[] = [{ isActive: true, deletedAt: null }];
      if (q) {
        conditions.push({
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { ownerName: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
          ],
        });
      }
      if (hq) {
        conditions.push({
          OR: [
            { hq: { name: { contains: hq, mode: 'insensitive' } } },
            { city: { contains: hq, mode: 'insensitive' } },
          ],
        });
      }

      const retailers = await prisma.retailer.findMany({
        where: { AND: conditions },
        include: { hq: true },
        take: 8,
      });

      const total = await prisma.retailer.count({ where: { AND: conditions } });

      return {
        actionType: 'RETAILER_LIST',
        title: `Chemists / Retailers Found (${total})`,
        data: {
          query: q || hq,
          total,
          retailers: retailers.map(r => ({
            id: r.id,
            name: r.name,
            owner: r.ownerName,
            city: r.city,
            hq: r.hq?.name || 'HQ',
            phone: r.phone,
          })),
        },
        message: `कुल **${total} केमिस्ट/रिटेलर्स** मिले।\n` + retailers.slice(0, 5).map(r => `• **${r.name}** (${r.hq?.name || r.city || 'HQ'})`).join('\n'),
        link: `/dashboard/retailers`,
      };
    }

    case 'assign_visit': {
      const rep = await findRepByName(args.mrName);
      if (!rep) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: {},
          message: `प्रतिनिधि "${args.mrName}" नहीं मिला।`,
        };
      }

      // Try finding doctor first, then retailer
      let doc = await findDoctorByName(args.targetName);
      let ret: any = null;
      if (!doc) {
        ret = await prisma.retailer.findFirst({
          where: { name: { contains: args.targetName.trim(), mode: 'insensitive' } },
        });
      }

      if (!doc && !ret) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: {},
          message: `विज़िट के लिए डॉक्टर या केमिस्ट "${args.targetName}" डेटाबेस में नहीं मिला।`,
        };
      }

      const targetDate = args.date ? new Date(args.date) : new Date();
      targetDate.setHours(10, 0, 0, 0);

      const newVisit = await prisma.visit.create({
        data: {
          userId: rep.id,
          doctorId: doc ? doc.id : undefined,
          retailerId: ret ? ret.id : undefined,
          visitType: doc ? 'DOCTOR' : 'RETAILER',
          plannedDate: targetDate,
          status: 'PLANNED',
          priority: 'NORMAL',
        },
      });

      const targetTitle = doc ? `Dr. ${doc.firstName} ${doc.lastName}` : ret.name;
      const repName = `${rep.firstName} ${rep.lastName}`;
      const dateStr = targetDate.toISOString().slice(0, 10);

      return {
        actionType: 'VISIT_ASSIGNED',
        title: `Visit Assigned to ${repName}`,
        data: {
          visitId: newVisit.id,
          repName,
          targetTitle,
          date: dateStr,
          type: newVisit.visitType,
        },
        message: `प्रतिनिधि **${repName}** को **${targetTitle}** के लिए **${dateStr}** की विज़िट सफलतापूर्वक असाइन कर दी गई है।`,
        link: `/dashboard/visits/monitor?repId=${rep.id}`,
      };
    }

    case 'get_orders_summary': {
      const isMonth = args.timeframe === 'this_month';
      const startDate = new Date();
      if (isMonth) {
        startDate.setDate(1);
      }
      startDate.setHours(0, 0, 0, 0);

      const orders = await prisma.order.findMany({
        where: { createdAt: { gte: startDate } },
        include: {
          user: { select: { firstName: true, lastName: true } },
          retailer: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalRevenue = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
      const totalCount = orders.length;

      return {
        actionType: 'ORDERS_SUMMARY',
        title: `Sales & Orders Summary (${isMonth ? 'This Month' : 'Today'})`,
        data: {
          timeframe: isMonth ? 'This Month' : 'Today',
          totalCount,
          totalRevenue,
          orders: orders.slice(0, 6).map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            amount: o.totalAmount,
            mr: `${o.user?.firstName} ${o.user?.lastName}`,
            retailer: o.retailer?.name || 'Retailer',
            status: o.status,
          })),
        },
        message: `कुल **${totalCount} ऑर्डर्स** बुक हुए, कुल रेवेन्यू: **₹${totalRevenue.toLocaleString()}**।`,
        link: `/dashboard/orders`,
      };
    }

    case 'get_pending_approvals': {
      const [pendingDoctors, pendingLeaves, pendingExpenses] = await Promise.all([
        prisma.doctor.findMany({
          where: { approvalStatus: 'PENDING', deletedAt: null },
          select: { id: true, firstName: true, lastName: true, specialty: true, city: true, doctorCode: true },
          take: 5,
        }),
        prisma.leave.findMany({
          where: { approvalStatus: 'PENDING' },
          include: { user: { select: { firstName: true, lastName: true } } },
          take: 5,
        }),
        prisma.expense.findMany({
          where: { approvalStatus: 'PENDING' },
          include: { user: { select: { firstName: true, lastName: true } } },
          take: 5,
        }),
      ]);

      const total = pendingDoctors.length + pendingLeaves.length + pendingExpenses.length;

      return {
        actionType: 'APPROVAL_ACTION',
        title: `Pending Approvals (${total})`,
        data: {
          doctors: pendingDoctors,
          leaves: pendingLeaves.map(l => ({
            id: l.id,
            repName: `${l.user?.firstName} ${l.user?.lastName}`,
            type: l.leaveType,
            days: l.totalDays,
            reason: l.reason,
          })),
          expenses: pendingExpenses.map(e => ({
            id: e.id,
            repName: `${e.user?.firstName} ${e.user?.lastName}`,
            amount: e.amount,
            category: e.expenseType,
          })),
        },
        message: `लंबित स्वीकृतियां (Pending Approvals):\n• **${pendingDoctors.length} डॉक्टर्स** अनुमोदन प्रतीक्षारत\n• **${pendingLeaves.length} छुट्टियां (Leaves)**\n• **${pendingExpenses.length} खर्चे (Expenses)**`,
        link: `/dashboard/approvals`,
      };
    }

    case 'approve_or_reject_request': {
      const status = args.action === 'REJECT' ? 'REJECTED' : 'APPROVED';
      const target = args.targetNameOrId.trim();

      if (args.type === 'leave') {
        const leave = await prisma.leave.findFirst({
          where: {
            approvalStatus: 'PENDING',
            OR: [
              { id: target },
              { user: { firstName: { contains: target, mode: 'insensitive' } } },
            ],
          },
          include: { user: true },
        });

        if (!leave) {
          return {
            actionType: 'NONE' as any,
            title: '',
            data: {},
            message: `लंबित छुट्टी आवेदन "${target}" नहीं मिला।`,
          };
        }

        await prisma.leave.update({
          where: { id: leave.id },
          data: {
            approvalStatus: status,
            approvedAt: new Date(),
            approvedById: adminUser.id,
          },
        });

        const repName = `${leave.user?.firstName} ${leave.user?.lastName}`;
        return {
          actionType: 'APPROVAL_ACTION',
          title: `Leave ${status}: ${repName}`,
          data: { id: leave.id, status, repName },
          message: `कर्मचारी **${repName}** का छुट्टी आवेदन सफलतापूर्वक **${status === 'APPROVED' ? 'स्वीकृत (Approved)' : 'अस्वीकृत (Rejected)'}** कर दिया गया है।`,
          link: `/dashboard/attendance`,
        };
      }

      // Default to doctor approval
      const doc = await prisma.doctor.findFirst({
        where: {
          approvalStatus: 'PENDING',
          OR: [
            { id: target },
            { firstName: { contains: target, mode: 'insensitive' } },
            { doctorCode: { contains: target, mode: 'insensitive' } },
          ],
        },
      });

      if (!doc) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: {},
          message: `अनुमोदन के लिए लंबित डॉक्टर "${target}" नहीं मिले।`,
        };
      }

      await prisma.doctor.update({
        where: { id: doc.id },
        data: { approvalStatus: status },
      });

      const docName = `${doc.salutation || 'Dr.'} ${doc.firstName} ${doc.lastName}`;
      return {
        actionType: 'APPROVAL_ACTION',
        title: `Doctor ${status}: ${docName}`,
        data: { id: doc.id, status, docName },
        message: `डॉक्टर **${docName}** का पंजीकरण सफलतापूर्वक **${status === 'APPROVED' ? 'स्वीकृत (Approved)' : 'अस्वीकृत (Rejected)'}** कर दिया गया है।`,
        link: `/dashboard/doctors/${doc.id}`,
      };
    }

    case 'add_headquarter': {
      const name = (args.name || args.headquarterName || args.territoryName || 'New Territory').trim();
      const existing = await prisma.territory.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
      if (existing) {
        return {
          actionType: 'TERRITORY_CREATED',
          title: `Headquarter Exists: ${existing.name}`,
          data: { id: existing.id, name: existing.name, code: existing.code, state: existing.state },
          message: `हेडक्वार्टर **${existing.name}** (${existing.code}) पहले से पंजीकृत है।`,
          link: `/dashboard/territories`,
        };
      }

      const count = await prisma.territory.count();
      const code = args.code?.trim().toUpperCase() || `HQ-${name.slice(0, 3).toUpperCase()}-${String(count + 101)}`;
      const state = args.state?.trim() || 'Madhya Pradesh';

      const newHq = await prisma.territory.create({
        data: {
          name,
          code,
          state,
          district: args.district?.trim() || name,
        },
      });

      return {
        actionType: 'TERRITORY_CREATED',
        title: `New Headquarter Created: ${newHq.name}`,
        data: { id: newHq.id, name: newHq.name, code: newHq.code, state: newHq.state },
        message: `नया हेडक्वार्टर/टेरिटरी **${newHq.name}** (Code: ${newHq.code}, State: ${newHq.state}) सफलतापूर्वक बना दिया गया है।`,
        link: `/dashboard/territories`,
      };
    }

    case 'list_headquarters': {
      const q = (args.query || '').trim();
      const hqs = await prisma.territory.findMany({
        where: q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { state: { contains: q, mode: 'insensitive' } },
          ],
        } : undefined,
        include: {
          _count: {
            select: { doctorsHQ: true, employees: true },
          },
        },
        orderBy: { name: 'asc' },
        take: 12,
      });

      return {
        actionType: 'TERRITORY_LIST',
        title: `Headquarters & Territories (${hqs.length})`,
        data: {
          headquarters: hqs.map(h => ({
            id: h.id,
            name: h.name,
            code: h.code,
            state: h.state,
            doctorCount: h._count.doctorsHQ,
            repCount: h._count.employees,
          })),
        },
        message: `कुल **${hqs.length} हेडक्वार्टर** उपलब्ध हैं:\n` + hqs.slice(0, 6).map(h => `• **${h.name}** (${h.state}) - ${h._count.doctorsHQ} डॉक्टर्स, ${h._count.employees} MRs`).join('\n'),
        link: `/dashboard/territories`,
      };
    }

    case 'add_hospital': {
      let hqId: string | undefined;
      let hqName = args.headquarterName;
      if (hqName) {
        const foundHq = await prisma.territory.findFirst({
          where: { name: { contains: hqName.trim(), mode: 'insensitive' } },
        });
        if (foundHq) {
          hqId = foundHq.id;
          hqName = foundHq.name;
        }
      }

      const count = await prisma.hospital.count();
      const hospitalCode = `HOSP-${String(count + 101).padStart(4, '0')}`;
      const hospitalName = (args.name || 'New Hospital').trim();

      const newHospital = await prisma.hospital.create({
        data: {
          hospitalCode,
          name: hospitalName,
          city: args.city || hqName || 'General',
          hqId,
          territoryId: hqId,
          beds: args.beds ? Number(args.beds) : undefined,
          category: args.category || 'Multi-specialty',
          type: args.type || 'private',
          phone: args.phone || undefined,
          approvalStatus: 'APPROVED',
          isActive: true,
        },
        include: { hq: true },
      });

      return {
        actionType: 'HOSPITAL_CREATED',
        title: `Hospital Registered: ${newHospital.name}`,
        data: {
          id: newHospital.id,
          code: newHospital.hospitalCode,
          name: newHospital.name,
          city: newHospital.city,
          hq: newHospital.hq?.name || hqName || 'HQ',
          category: newHospital.category,
          beds: newHospital.beds,
        },
        message: `अस्पताल **${newHospital.name}** (${newHospital.hospitalCode}, ${newHospital.city}) सफलतापूर्वक जोड़ दिया गया है।`,
        link: `/dashboard/hospitals`,
      };
    }

    case 'search_hospitals': {
      const q = (args.query || '').trim();
      const hq = (args.headquarterName || '').trim();
      const conditions: Prisma.HospitalWhereInput[] = [{ isActive: true, deletedAt: null }];

      if (q) {
        conditions.push({
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
            { hospitalCode: { contains: q, mode: 'insensitive' } },
          ],
        });
      }
      if (hq) {
        conditions.push({
          OR: [
            { hq: { name: { contains: hq, mode: 'insensitive' } } },
            { city: { contains: hq, mode: 'insensitive' } },
          ],
        });
      }

      const hospitals = await prisma.hospital.findMany({
        where: { AND: conditions },
        include: { hq: true },
        take: 8,
      });
      const total = await prisma.hospital.count({ where: { AND: conditions } });

      return {
        actionType: 'HOSPITAL_LIST',
        title: `Hospitals Found (${total})`,
        data: {
          query: q || hq,
          total,
          hospitals: hospitals.map(h => ({
            id: h.id,
            name: h.name,
            code: h.hospitalCode,
            city: h.city,
            hq: h.hq?.name || 'HQ',
            beds: h.beds,
            type: h.type,
          })),
        },
        message: `कुल **${total} अस्पताल** मिले:\n` + hospitals.slice(0, 5).map(h => `• **${h.name}** (${h.city || h.hq?.name || 'HQ'})`).join('\n'),
        link: `/dashboard/hospitals`,
      };
    }

    case 'add_stockist': {
      let hqId: string | undefined;
      let hqName = args.headquarterName;
      if (hqName) {
        const foundHq = await prisma.territory.findFirst({
          where: { name: { contains: hqName.trim(), mode: 'insensitive' } },
        });
        if (foundHq) {
          hqId = foundHq.id;
          hqName = foundHq.name;
        }
      }

      const count = await prisma.stockist.count();
      const stockistCode = `STK-${String(count + 101).padStart(4, '0')}`;
      const stockistName = (args.name || 'New Stockist').trim();

      const newStockist = await prisma.stockist.create({
        data: {
          stockistCode,
          name: stockistName,
          city: args.city || hqName || 'General',
          hqId,
          mobileNumber: args.mobileNumber || undefined,
          gstinNumber: args.gstinNumber || undefined,
          contactFirstName: args.contactPerson || undefined,
          approvalStatus: 'APPROVED',
          isActive: true,
        },
        include: { hq: true },
      });

      return {
        actionType: 'STOCKIST_CREATED',
        title: `Stockist Registered: ${newStockist.name}`,
        data: {
          id: newStockist.id,
          code: newStockist.stockistCode,
          name: newStockist.name,
          city: newStockist.city,
          hq: newStockist.hq?.name || hqName || 'HQ',
          mobile: newStockist.mobileNumber || 'N/A',
        },
        message: `स्टॉकिस्ट **${newStockist.name}** (${newStockist.stockistCode}, ${newStockist.city}) सफलतापूर्वक जोड़ दिया गया है।`,
        link: `/dashboard/stockists`,
      };
    }

    case 'search_stockists': {
      const q = (args.query || '').trim();
      const hq = (args.headquarterName || '').trim();
      const conditions: Prisma.StockistWhereInput[] = [{ isActive: true, deletedAt: null }];

      if (q) {
        conditions.push({
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
            { stockistCode: { contains: q, mode: 'insensitive' } },
          ],
        });
      }
      if (hq) {
        conditions.push({
          OR: [
            { hq: { name: { contains: hq, mode: 'insensitive' } } },
            { city: { contains: hq, mode: 'insensitive' } },
          ],
        });
      }

      const stockists = await prisma.stockist.findMany({
        where: { AND: conditions },
        include: { hq: true },
        take: 8,
      });
      const total = await prisma.stockist.count({ where: { AND: conditions } });

      return {
        actionType: 'STOCKIST_LIST',
        title: `Stockists Found (${total})`,
        data: {
          query: q || hq,
          total,
          stockists: stockists.map(s => ({
            id: s.id,
            name: s.name,
            code: s.stockistCode,
            city: s.city,
            hq: s.hq?.name || 'HQ',
            phone: s.mobileNumber || 'N/A',
          })),
        },
        message: `कुल **${total} स्टॉकिस्ट** मिले:\n` + stockists.slice(0, 5).map(s => `• **${s.name}** (${s.city || 'General'})`).join('\n'),
        link: `/dashboard/stockists`,
      };
    }

    case 'get_attendance_summary': {
      const targetDate = args.date ? new Date(args.date) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const [attendances, totalFieldUsers] = await Promise.all([
        prisma.attendance.findMany({
          where: { date: { gte: startOfDay, lte: endOfDay } },
          include: { user: { select: { firstName: true, lastName: true, role: true, hq: true } } },
        }),
        prisma.user.count({ where: { isActive: true, role: { in: ['MR', 'ASM', 'RSM', 'TRADE_REP'] } } }),
      ]);

      const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
      const onLeaveCount = attendances.filter(a => a.status === 'ON_LEAVE').length;
      const checkedInCount = attendances.filter(a => a.checkInTime !== null).length;
      const absentCount = Math.max(0, totalFieldUsers - presentCount - onLeaveCount);

      return {
        actionType: 'ATTENDANCE_SUMMARY',
        title: `Attendance Summary (${targetDate.toISOString().slice(0, 10)})`,
        data: {
          date: targetDate.toISOString().slice(0, 10),
          totalFieldUsers,
          presentCount,
          checkedInCount,
          onLeaveCount,
          absentCount,
          attendances: attendances.slice(0, 6).map(a => ({
            name: `${a.user.firstName} ${a.user.lastName}`,
            status: a.status,
            checkIn: a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
          })),
        },
        message: `उपस्थिति सारांश (Attendance):\n• कुल फ़ील्ड स्टाफ: **${totalFieldUsers}**\n• उपस्थित (Present): **${presentCount}** (${checkedInCount} चेक-इन)\n• छुट्टी पर (On Leave): **${onLeaveCount}**\n• अनुपस्थित (Absent): **${absentCount}**`,
        link: `/dashboard/attendance`,
      };
    }

    case 'add_scheme': {
      const schemeTitle = (args.name || 'New Promotional Scheme').trim();
      const discountType = args.discountType || 'PERCENTAGE';
      const discountValue = args.discountValue !== undefined ? Number(args.discountValue) : 10;

      const newScheme = await prisma.tradeScheme.create({
        data: {
          name: schemeTitle,
          description: args.description || 'Promotional trade offer created by Super Admin via Copilot',
          discountType,
          discountValue,
          minQuantity: args.minQuantity ? Number(args.minQuantity) : 10,
          isActive: true,
        },
      });

      return {
        actionType: 'SCHEME_CREATED',
        title: `Trade Scheme Created: ${newScheme.name}`,
        data: {
          id: newScheme.id,
          name: newScheme.name,
          discountType: newScheme.discountType,
          discountValue: newScheme.discountValue,
          minQuantity: newScheme.minQuantity,
        },
        message: `नई ट्रेड स्कीम **${newScheme.name}** (${newScheme.discountType}: ${newScheme.discountValue}) सफलतापूर्वक लागू कर दी गई है।`,
        link: `/dashboard/schemes`,
      };
    }

    case 'list_schemes': {
      const q = (args.query || '').trim();
      const schemes = await prisma.tradeScheme.findMany({
        where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 8,
      });

      return {
        actionType: 'SCHEME_LIST',
        title: `Active Trade Schemes (${schemes.length})`,
        data: {
          schemes: schemes.map(s => ({
            id: s.id,
            name: s.name,
            discountType: s.discountType,
            discountValue: s.discountValue,
            minQuantity: s.minQuantity,
          })),
        },
        message: `सक्रिय स्कीम्स (${schemes.length}):\n` + schemes.slice(0, 5).map(s => `• **${s.name}** - ${s.discountValue}% (${s.discountType})`).join('\n'),
        link: `/dashboard/schemes`,
      };
    }

    case 'get_sample_distribution': {
      const distributions = await prisma.sampleDistribution.findMany({
        include: {
          sampleProduct: { select: { name: true, code: true } },
          user: { select: { firstName: true, lastName: true } },
          doctor: { select: { firstName: true, lastName: true, specialty: true } },
        },
        orderBy: { distributedAt: 'desc' },
        take: 8,
      });

      return {
        actionType: 'SAMPLE_SUMMARY',
        title: `Sample Distribution Summary (${distributions.length})`,
        data: {
          total: distributions.length,
          distributions: distributions.map(d => ({
            id: d.id,
            sample: d.sampleProduct?.name || 'Sample Product',
            qty: d.quantity,
            mr: `${d.user?.firstName} ${d.user?.lastName}`,
            doctor: d.doctor ? `Dr. ${d.doctor.firstName} ${d.doctor.lastName}` : 'N/A',
            date: d.distributedAt.toISOString().slice(0, 10),
          })),
        },
        message: `सैंपल डिस्ट्रीब्यूशन रिकॉर्ड्स (${distributions.length}):\n` + distributions.slice(0, 5).map(d => `• **${d.sampleProduct?.name}** (${d.quantity} units) दिए गए ${d.doctor ? `Dr. ${d.doctor.firstName}` : ''}`).join('\n'),
        link: `/dashboard/samples`,
      };
    }

    case 'get_tour_plans': {
      const plans = await prisma.tourPlan.findMany({
        include: {
          user: { select: { firstName: true, lastName: true, role: true } },
          hq: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });

      return {
        actionType: 'TOUR_PLAN_ACTION',
        title: `Tour Plans / MTP (${plans.length})`,
        data: {
          plans: plans.map(p => ({
            id: p.id,
            repName: `${p.user?.firstName} ${p.user?.lastName}`,
            hq: p.hq?.name || 'HQ',
            month: p.planMonth || 'Current',
            status: p.approvalStatus,
            workingDays: p.workingDays,
          })),
        },
        message: `टूर प्रोग्राम्स (Tour Plans / MTP):\n` + plans.slice(0, 5).map(p => `• **${p.user?.firstName} ${p.user?.lastName}** - ${p.planMonth || 'MTP'} (${p.approvalStatus})`).join('\n'),
        link: `/dashboard/tourplans`,
      };
    }

    case 'approve_tour_plan': {
      const status = args.action === 'REJECT' ? 'REJECTED' : 'APPROVED';
      const target = args.mrNameOrPlanId.trim();

      const plan = await prisma.tourPlan.findFirst({
        where: {
          OR: [
            { id: target },
            { user: { firstName: { contains: target, mode: 'insensitive' } } },
          ],
        },
        include: { user: true },
      });

      if (!plan) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: {},
          message: `टूर प्लान "${target}" नहीं मिला।`,
        };
      }

      await prisma.tourPlan.update({
        where: { id: plan.id },
        data: { approvalStatus: status },
      });

      const repName = `${plan.user?.firstName} ${plan.user?.lastName}`;
      return {
        actionType: 'TOUR_PLAN_ACTION',
        title: `Tour Plan ${status}: ${repName}`,
        data: { id: plan.id, status, repName },
        message: `कर्मचारी **${repName}** का टूर प्रोग्राम सफलतापूर्वक **${status === 'APPROVED' ? 'स्वीकृत (Approved)' : 'अस्वीकृत (Rejected)'}** कर दिया गया है।`,
        link: `/dashboard/tourplans`,
      };
    }

    case 'send_team_broadcast': {
      const activeUsers = await prisma.user.findMany({
        where: { isActive: true, role: { in: ['MR', 'ASM', 'RSM', 'TRADE_REP'] } },
        select: { id: true },
      });

      const title = args.title?.trim() || 'Super Admin Notice';
      const body = args.message.trim();

      await prisma.notification.createMany({
        data: activeUsers.map(u => ({
          toUserId: u.id,
          fromUserId: adminUser.id,
          title,
          body,
          type: 'BROADCAST',
          isRead: false,
        })),
      });

      return {
        actionType: 'BROADCAST_SENT',
        title: `Broadcast Sent to ${activeUsers.length} Field Reps`,
        data: { title, body, count: activeUsers.length },
        message: `घोषणा/सूचना **${activeUsers.length} फ़ील्ड प्रतिनिधियों** को सफलतापूर्वक प्रसारित (Broadcast) कर दी गई है:\n"${body}"`,
      };
    }

    case 'set_sales_target': {
      const hqName = args.headquarterName.trim();
      const foundHq = await prisma.territory.findFirst({
        where: { name: { contains: hqName, mode: 'insensitive' } },
      });

      if (!foundHq) {
        return {
          actionType: 'NONE' as any,
          title: '',
          data: {},
          message: `हेडक्वार्टर "${hqName}" नहीं मिला।`,
        };
      }

      const year = args.year ? Number(args.year) : new Date().getFullYear();
      const targetAmount = Number(args.targetAmount);

      await prisma.target.create({
        data: {
          targetYear: year,
          targetAmount,
          hqId: foundHq.id,
        },
      });

      return {
        actionType: 'TARGET_ACTION',
        title: `Sales Target Set: ${foundHq.name}`,
        data: {
          hq: foundHq.name,
          year,
          targetAmount,
        },
        message: `हेडक्वार्टर **${foundHq.name}** के लिए वर्ष **${year}** का सेल्स टारगेट **₹${targetAmount.toLocaleString()}** निर्धारित कर दिया गया है।`,
        link: `/dashboard/targets`,
      };
    }

    case 'get_targets_summary': {
      const year = args.year ? Number(args.year) : new Date().getFullYear();
      const targets = await prisma.target.findMany({
        where: { targetYear: year },
        include: { hq: true },
        take: 8,
      });

      const totalTarget = targets.reduce((acc, t) => acc + (t.targetAmount || 0), 0);

      return {
        actionType: 'TARGET_ACTION',
        title: `Sales Targets (${year})`,
        data: {
          year,
          totalTarget,
          targets: targets.map(t => ({
            id: t.id,
            hq: t.hq?.name || 'HQ',
            amount: t.targetAmount,
          })),
        },
        message: `वर्ष **${year}** के सेल्स टारगेट्स (कुल: ₹${totalTarget.toLocaleString()}):\n` + targets.slice(0, 5).map(t => `• **${t.hq?.name}**: ₹${t.targetAmount.toLocaleString()}`).join('\n'),
        link: `/dashboard/targets`,
      };
    }

    case 'get_expenses_summary': {
      const isMonth = args.timeframe === 'this_month';
      const startDate = new Date();
      if (isMonth) startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      const expenses = await prisma.expense.findMany({
        where: { createdAt: { gte: startDate } },
        include: {
          user: { select: { firstName: true, lastName: true } },
          hq: { select: { name: true } },
        },
        take: 8,
        orderBy: { createdAt: 'desc' },
      });

      const totalClaimed = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

      return {
        actionType: 'EXPENSES_SUMMARY',
        title: `Field Expenses (${isMonth ? 'This Month' : 'Today'})`,
        data: {
          totalClaimed,
          count: expenses.length,
          expenses: expenses.map(e => ({
            id: e.id,
            mr: `${e.user?.firstName} ${e.user?.lastName}`,
            amount: e.amount,
            hq: e.hq?.name || 'HQ',
            category: e.expenseType || e.claimCategory || 'TA/DA',
            status: e.approvalStatus,
          })),
        },
        message: `कुल खर्चे (Expenses): **₹${totalClaimed.toLocaleString()}** (${expenses.length} दावे/claims):\n` + expenses.slice(0, 5).map(e => `• **${e.user?.firstName} ${e.user?.lastName}**: ₹${e.amount} (${e.approvalStatus})`).join('\n'),
        link: `/dashboard/expenses`,
      };
    }

    case 'add_task': {
      const title = args.title.trim();
      let assignedToId: string | undefined;
      let repName: string = 'Field Team';

      if (args.mrName) {
        const rep = await findRepByName(args.mrName);
        if (rep) {
          assignedToId = rep.id;
          repName = `${rep.firstName} ${rep.lastName}`;
        }
      }

      const newTask = await prisma.task.create({
        data: {
          title,
          assignedToId,
          createdById: adminUser.id,
          priority: (args.priority || 'MEDIUM') as any,
          dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
          status: 'NOT_STARTED',
        },
      });

      return {
        actionType: 'TASK_CREATED',
        title: `Task Created: ${newTask.title}`,
        data: {
          id: newTask.id,
          title: newTask.title,
          assignedTo: repName,
          priority: newTask.priority,
        },
        message: `टास्क **"${newTask.title}"** सफलतापूर्वक बनाया गया और **${repName}** को असाइन किया गया।`,
        link: `/dashboard/tasks`,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Smart Local Intent Fallback Parser (Works without OpenRouter API Key) ────
async function parseLocalIntent(prompt: string, adminUser: { id: string; role: string }): Promise<{ reply: string; action?: AgentActionResult } | null> {
  const p = prompt.toLowerCase().trim();

  // 0. Headquarter Doctor Count / Statistics Intent:
  const isDoctorCount =
    (p.includes('kitne') || p.includes('कितने') || p.includes('count') || p.includes('total') || p.includes('number of') || p.includes('list') || p.includes('सारे')) &&
    (p.includes('doctor') || p.includes('डॉक्टर') || p.includes('doc'));

  if (isDoctorCount) {
    const knownHqs = ['indore', 'nagpur', 'wardha', 'ujjain', 'burhanpur', 'dhar', 'khargoan', 'akola', 'yavatmal', 'इन्दौर', 'नागपुर', 'उज्जैन', 'वर्धा', 'बुरहानपुर'];
    let targetHq: string | undefined;

    for (const hq of knownHqs) {
      if (p.includes(hq)) {
        targetHq = hq.charAt(0).toUpperCase() + hq.slice(1);
        break;
      }
    }

    const action = await executeTool('get_headquarter_doctors_count', { headquarterName: targetHq }, adminUser);
    return { reply: action.message, action };
  }

  // 1. Doctor Addition Intent:
  const isDoctorAdd =
    (p.includes('doctor') || p.includes('डॉक्टर') || p.includes('dr')) &&
    (p.includes('add') || p.includes('create') || p.includes('जोड़') || p.includes('शामिल') || p.includes('रजिस्टर') || p.includes('register'));

  if (isDoctorAdd) {
    let nameMatch = prompt.match(/(?:doctor|डॉक्टर|dr\.?)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
    let name = nameMatch ? nameMatch[1].trim() : 'Rajesh';
    let parts = name.split(/\s+/);
    let firstName = parts[0] || 'New';
    let lastName = parts.slice(1).join(' ') || 'Doctor';

    let hqMatch = prompt.match(/(?:in|to|में|HQ|headquarter|territory)\s+([A-Za-z\u0900-\u097F]+)/i);
    let hqName = hqMatch ? hqMatch[1].trim() : 'Nagpur';

    let specialty = 'General Medicine';
    if (p.includes('cardio') || p.includes('कार्डियो')) specialty = 'Cardiology';
    else if (p.includes('pedia') || p.includes('शिशु')) specialty = 'Pediatrics';
    else if (p.includes('ortho') || p.includes('हड्डी')) specialty = 'Orthopedics';
    else if (p.includes('derma') || p.includes('त्वचा')) specialty = 'Dermatology';
    else if (p.includes('gyn') || p.includes('स्त्री')) specialty = 'Gynecology';
    else if (p.includes('neuro') || p.includes('न्यूरो')) specialty = 'Neurology';

    const action = await executeTool('add_doctor', {
      firstName,
      lastName,
      specialty,
      qualification: 'MBBS, MD',
      headquarterName: hqName,
    }, adminUser);

    return {
      reply: `✅ डॉक्टर **Dr. ${firstName} ${lastName}** को **${hqName}** हेडक्वार्टर में **${specialty}** स्पेशियलिटी के साथ सफलतापूर्वक रजिस्टर कर दिया गया है।`,
      action,
    };
  }

  // 2. Doctor Delete / Deactivate Intent:
  const isDoctorDelete =
    (p.includes('doctor') || p.includes('डॉक्टर') || p.includes('dr')) &&
    (p.includes('delete') || p.includes('हटाओ') || p.includes('deactivate') || p.includes('निष्क्रिय') || p.includes('हटा'));

  if (isDoctorDelete) {
    let nameMatch = prompt.match(/(?:doctor|डॉक्टर|dr\.?)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
    let target = nameMatch ? nameMatch[1].trim() : 'Rajesh';
    const action = await executeTool('delete_doctor', { doctorNameOrCode: target }, adminUser);
    return { reply: action.message, action };
  }

  // 3. Product Addition Intent:
  const isProductAdd =
    (p.includes('product') || p.includes('दवा') || p.includes('medicine') || p.includes('दवाई')) &&
    (p.includes('add') || p.includes('create') || p.includes('जोड़') || p.includes('नया') || p.includes('शामिल'));

  if (isProductAdd) {
    let cleanPrompt = prompt
      .replace(/(?:naya|new|add|create|karo|करो|जोड़ो|रजिस्टर|product|दवा|दवाई|medicine)\s+/gi, ' ')
      .replace(/(?:mrp|₹|rs\.?|price)\s*[:=]?\s*\d+/gi, '')
      .replace(/(?:tablet|syrup|injection|capsule)/gi, '')
      .trim();
    let name = cleanPrompt.split(/\s+/).slice(0, 2).join(' ').trim() || 'Biocros-Brand';
    let mrpMatch = prompt.match(/(?:mrp|₹|rs\.?|price)\s*[:=]?\s*(\d+)/i);
    let mrp = mrpMatch ? Number(mrpMatch[1]) : 150;

    const action = await executeTool('add_product', {
      name,
      composition: 'Standard Pharma Formulation',
      mrp,
      ptr: mrp * 0.75,
      category: p.includes('syrup') ? 'Syrup' : p.includes('injection') ? 'Injection' : 'Tablet',
    }, adminUser);

    return { reply: action.message, action };
  }

  // 4. Product Search Intent:
  const isProductSearch =
    (p.includes('product') || p.includes('दवा') || p.includes('medicine') || p.includes('कैटलॉग')) &&
    (p.includes('search') || p.includes('list') || p.includes('खोजो') || p.includes('dikhao') || p.includes('दिखाओ') || p.includes('catalog'));

  if (isProductSearch) {
    let qMatch = prompt.match(/(?:search|खोजो|find|product)\s+([A-Za-z0-9\-]+)/i);
    let query = qMatch ? qMatch[1].trim() : '';
    const action = await executeTool('search_products', { query }, adminUser);
    return { reply: action.message, action };
  }

  // 5. Employee / MR Addition Intent:
  const isEmpAdd =
    (p.includes('mr') || p.includes('employee') || p.includes('कर्मचारी') || p.includes('rep')) &&
    (p.includes('add') || p.includes('onboard') || p.includes('जोड़') || p.includes('नया') || p.includes('रजिस्टर'));

  if (isEmpAdd) {
    let nameMatch = prompt.match(/(?:mr|employee|कर्मचारी)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
    let name = nameMatch ? nameMatch[1].trim() : 'New Rep';
    let parts = name.split(/\s+/);
    let firstName = parts[0] || 'Field';
    let lastName = parts.slice(1).join(' ') || 'Representative';

    let hqMatch = prompt.match(/(?:in|to|में|HQ|headquarter|territory)\s+([A-Za-z\u0900-\u097F]+)/i);
    let hqName = hqMatch ? hqMatch[1].trim() : 'Indore';

    const action = await executeTool('add_employee', {
      firstName,
      lastName,
      role: p.includes('asm') ? 'ASM' : p.includes('rsm') ? 'RSM' : 'MR',
      headquarterName: hqName,
    }, adminUser);

    return { reply: action.message, action };
  }

  // 6. Retailer / Chemist Addition Intent:
  const isRetailerAdd =
    (p.includes('retailer') || p.includes('chemist') || p.includes('केमिस्ट') || p.includes('medical store') || p.includes('दुकान')) &&
    (p.includes('add') || p.includes('जोड़') || p.includes('नया') || p.includes('रजिस्टर'));

  if (isRetailerAdd) {
    let cleanPrompt = prompt
      .replace(/(?:naya|new|add|create|karo|करो|जोड़ो|रजिस्टर|chemist|retailer|केमिस्ट|store|medical)\s+/gi, ' ')
      .replace(/(?:in|to|में|city|शहर|hq)\s+[A-Za-z\u0900-\u097F]+/gi, '')
      .trim();
    let name = cleanPrompt.split(/\s+/).slice(0, 3).join(' ').trim() || 'New Medicos';

    let hqMatch = prompt.match(/(?:in|to|में|HQ|city|शहर)\s+([A-Za-z\u0900-\u097F]+)/i);
    let city = hqMatch ? hqMatch[1].trim() : 'Indore';

    const action = await executeTool('add_retailer', {
      name,
      city,
      headquarterName: city,
    }, adminUser);

    return { reply: action.message, action };
  }

  // 7. Headquarter Addition Intent:
  const isHqAdd =
    (p.includes('headquarter') || p.includes('territory') || p.includes('मुख्यालय') || p.includes('टेरिटरी')) &&
    (p.includes('add') || p.includes('create') || p.includes('जोड़') || p.includes('नया'));

  if (isHqAdd) {
    let nameMatch = prompt.match(/(?:headquarter|territory|मुख्यालय|टेरिटरी)\s+(?:create\s+karo\s+|create\s+|add\s+karo\s+|add\s+)?([A-Za-z\u0900-\u097F]+)/i);
    let name = nameMatch ? nameMatch[1].trim() : 'Raipur';
    let stateMatch = prompt.match(/(?:,|\bin\b|\bstate\b)\s*([A-Za-z\u0900-\u097F]+)/i);
    let state = stateMatch ? stateMatch[1].trim() : 'Madhya Pradesh';

    const action = await executeTool('add_headquarter', { name, state }, adminUser);
    return { reply: action.message, action };
  }

  // 8. Headquarter List Intent:
  const isHqList =
    (p.includes('headquarter') || p.includes('territory') || p.includes('मुख्यालय') || p.includes('टेरिटरी')) &&
    (p.includes('list') || p.includes('dikhao') || p.includes('सारे') || p.includes('दिखाओ') || p.includes('all'));

  if (isHqList) {
    const action = await executeTool('list_headquarters', {}, adminUser);
    return { reply: action.message, action };
  }

  // 9. Bulk Cancel Intent:
  const isCancel =
    (p.includes('cancel') || p.includes('कैंसिल') || p.includes('रद्द')) &&
    (p.includes('visit') || p.includes('विजिट') || p.includes('call') || p.includes('कॉल') || p.includes('सारी'));

  if (isCancel) {
    let mrMatch = prompt.match(/(?:for|की|का|mr)\s+([A-Za-z\u0900-\u097F]+)/i);
    let mrName = mrMatch ? mrMatch[1].trim() : 'Rahul';

    const action = await executeTool('bulk_cancel_visits', {
      mrName,
      reason: 'Cancelled by Admin Copilot upon request',
    }, adminUser);

    return { reply: action.message, action };
  }

  // 10. Orders & Sales Summary:
  const isOrders =
    p.includes('order') || p.includes('ऑर्डर') || p.includes('sales') || p.includes('बिक्री') || p.includes('revenue');

  if (isOrders) {
    const action = await executeTool('get_orders_summary', {
      timeframe: p.includes('month') || p.includes('महीने') ? 'this_month' : 'today',
    }, adminUser);
    return { reply: action.message, action };
  }

  // 11. Approvals Intent:
  const isApproval =
    p.includes('approval') || p.includes('स्वीकृति') || p.includes('स्वीकृत') || p.includes('pending') || p.includes('approve') || p.includes('reject');

  if (isApproval) {
    if (p.includes('approve') || p.includes('reject')) {
      const isReject = p.includes('reject') || p.includes('रद्द') || p.includes('अस्वीकृत');
      let targetMatch = prompt.match(/(?:approve|reject)\s+([A-Za-z0-9\u0900-\u097F]+)/i);
      let target = targetMatch ? targetMatch[1].trim() : 'Doctor';

      const action = await executeTool('approve_or_reject_request', {
        type: p.includes('leave') ? 'leave' : 'doctor',
        targetNameOrId: target,
        action: isReject ? 'REJECT' : 'APPROVE',
      }, adminUser);
      return { reply: action.message, action };
    }

    const action = await executeTool('get_pending_approvals', {}, adminUser);
    return { reply: action.message, action };
  }

  // 12. MR Report Intent:
  const isReport =
    (p.includes('report') || p.includes('रिपोर्ट') || p.includes('summary') || p.includes('dcr') || p.includes('stats') || p.includes('visit') || p.includes('विजिट')) &&
    (p.includes('mr') || p.includes('की') || p.includes('का') || p.includes('for') || p.includes('today') || p.includes('आज'));

  if (isReport) {
    const isTeam = p.includes('all') || p.includes('sab') || p.includes('sabhi') || p.includes('team') || p.includes('mr today report') || p === 'mr report' || p === 'mr today';

    if (isTeam) {
      const action = await executeTool('get_team_activity_report', {}, adminUser);
      return { reply: action.message, action };
    }

    let mrMatch = prompt.match(/(?:mr|की|का|for)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
    let mrName = mrMatch ? mrMatch[1].trim() : '';

    if (!mrName) {
      let beforeKi = prompt.match(/^([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)\s+(?:की|ki)/i);
      if (beforeKi) mrName = beforeKi[1].trim();
    }

    const action = await executeTool('get_mr_activity_report', { mrName: mrName || 'all' }, adminUser);
    return {
      reply: action.message,
      action: action.actionType !== ('NONE' as any) ? action : undefined,
    };
  }

  // 13. Search Doctor Intent:
  if (p.includes('search') || p.includes('खोजो') || p.includes('dhundo') || p.includes('find doctor')) {
    let qMatch = prompt.match(/(?:search|खोजो|find|doctor)\s+(?:for\s+)?([A-Za-z0-9\u0900-\u097F]+)/i);
    let query = qMatch ? qMatch[1].trim() : 'Dr';
    const action = await executeTool('search_doctors', { query }, adminUser);
    return { reply: action.message, action };
  }

  // 14. Dashboard Summary:
  if (p.includes('overview') || p.includes('summary') || p.includes('आज का') || p.includes('today') || p.includes('dashboard')) {
    const action = await executeTool('get_dashboard_summary', {}, adminUser);
    return { reply: action.message, action };
  }

  // 15. Hospital Intent:
  const isHospital = p.includes('hospital') || p.includes('अस्पताल');
  if (isHospital) {
    if (p.includes('add') || p.includes('create') || p.includes('जोड़') || p.includes('नया') || p.includes('register')) {
      let nameMatch = prompt.match(/(?:hospital|अस्पताल)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
      let name = nameMatch ? nameMatch[1].trim() : 'City Care Hospital';
      let hqMatch = prompt.match(/(?:in|to|में|city|शहर|hq)\s+([A-Za-z\u0900-\u097F]+)/i);
      let city = hqMatch ? hqMatch[1].trim() : 'Indore';
      let bedsMatch = prompt.match(/(?:beds?|बिस्तर)\s*[:=]?\s*(\d+)/i);
      let beds = bedsMatch ? Number(bedsMatch[1]) : 50;

      const action = await executeTool('add_hospital', {
        name,
        city,
        headquarterName: city,
        beds,
      }, adminUser);
      return { reply: action.message, action };
    }

    let qMatch = prompt.match(/(?:search|खोजो|find|hospital|अस्पताल)\s+([A-Za-z0-9\u0900-\u097F]+)/i);
    let query = qMatch ? qMatch[1].trim() : '';
    const action = await executeTool('search_hospitals', { query }, adminUser);
    return { reply: action.message, action };
  }

  // 16. Stockist Intent:
  const isStockist = p.includes('stockist') || p.includes('स्टॉकिस्ट') || p.includes('distributor') || p.includes('डिस्ट्रीब्यूटर');
  if (isStockist) {
    if (p.includes('add') || p.includes('create') || p.includes('जोड़') || p.includes('नया') || p.includes('register')) {
      let nameMatch = prompt.match(/(?:stockist|स्टॉकिस्ट|distributor)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
      let name = nameMatch ? nameMatch[1].trim() : 'Apex Pharma Distributors';
      let hqMatch = prompt.match(/(?:in|to|में|city|शहर|hq)\s+([A-Za-z\u0900-\u097F]+)/i);
      let city = hqMatch ? hqMatch[1].trim() : 'Indore';

      const action = await executeTool('add_stockist', {
        name,
        city,
        headquarterName: city,
      }, adminUser);
      return { reply: action.message, action };
    }

    let qMatch = prompt.match(/(?:search|खोजो|find|stockist|स्टॉकिस्ट)\s+([A-Za-z0-9\u0900-\u097F]+)/i);
    let query = qMatch ? qMatch[1].trim() : '';
    const action = await executeTool('search_stockists', { query }, adminUser);
    return { reply: action.message, action };
  }

  // 17. Attendance Intent:
  const isAttendance =
    p.includes('attendance') || p.includes('हाजिरी') || p.includes('उपस्थिति') ||
    (p.includes('present') && (p.includes('mr') || p.includes('team') || p.includes('staff'))) ||
    (p.includes('absent') && (p.includes('mr') || p.includes('team') || p.includes('staff')));
  if (isAttendance) {
    const action = await executeTool('get_attendance_summary', {}, adminUser);
    return { reply: action.message, action };
  }

  // 18. Trade Schemes Intent:
  const isScheme = p.includes('scheme') || p.includes('स्कीम') || p.includes('discount offer');
  if (isScheme) {
    if (p.includes('add') || p.includes('create') || p.includes('जोड़') || p.includes('नयी') || p.includes('नई')) {
      let nameMatch = prompt.match(/(?:scheme|स्कीम)\s+([A-Za-z0-9\u0900-\u097F]+(?:\s+[A-Za-z0-9\u0900-\u097F]+)?)/i);
      let name = nameMatch ? nameMatch[1].trim() : 'Monsoon Booster Offer';
      let discMatch = prompt.match(/(?:discount|छूट|off)\s*[:=]?\s*(\d+)/i) || prompt.match(/(\d+)%/);
      let discountValue = discMatch ? Number(discMatch[1]) : 10;

      const action = await executeTool('add_scheme', {
        name,
        discountType: 'PERCENTAGE',
        discountValue,
      }, adminUser);
      return { reply: action.message, action };
    }

    const action = await executeTool('list_schemes', {}, adminUser);
    return { reply: action.message, action };
  }

  // 19. Sample Distribution Intent:
  const isSample = p.includes('sample') || p.includes('सैंपल') || p.includes('sampling');
  if (isSample) {
    const action = await executeTool('get_sample_distribution', {}, adminUser);
    return { reply: action.message, action };
  }

  // 20. Tour Plans / MTP Intent:
  const isTour = p.includes('tour') || p.includes('mtp') || p.includes('टूर') || p.includes('tour plan');
  if (isTour) {
    if (p.includes('approve') || p.includes('reject') || p.includes('स्वीकृत') || p.includes('अस्वीकृत')) {
      const isReject = p.includes('reject') || p.includes('अस्वीकृत');
      let targetMatch = prompt.match(/(?:approve|reject|स्वीकृत|अस्वीकृत)\s+([A-Za-z0-9\u0900-\u097F]+)/i);
      let target = targetMatch ? targetMatch[1].trim() : 'Rahul';

      const action = await executeTool('approve_tour_plan', {
        mrNameOrPlanId: target,
        action: isReject ? 'REJECT' : 'APPROVE',
      }, adminUser);
      return { reply: action.message, action };
    }

    const action = await executeTool('get_tour_plans', {}, adminUser);
    return { reply: action.message, action };
  }

  // 21. Team Broadcast Intent:
  const isBroadcast =
    p.includes('broadcast') || p.includes('ब्रॉडकास्ट') || p.includes('announcement') ||
    (p.includes('notice') && p.includes('team')) ||
    ((p.includes('message') || p.includes('संदेश')) && (p.includes('team') || p.includes('sabko') || p.includes('all')));
  if (isBroadcast) {
    let cleanMsg = prompt
      .replace(/(?:broadcast|ब्रॉडकास्ट|send|announcement|bhejo|भेजो|karo|करो|message|संदेश|team|ko|ko\s+message)\s+/gi, ' ')
      .trim();
    const action = await executeTool('send_team_broadcast', {
      title: 'Admin Notice',
      message: cleanMsg || 'Important announcement from Super Admin.',
    }, adminUser);
    return { reply: action.message, action };
  }

  // 22. Sales Targets Intent:
  const isTarget = p.includes('target') || p.includes('टारगेट');
  if (isTarget) {
    if (p.includes('set') || p.includes('add') || p.includes('assign') || p.includes('बनाओ') || p.includes('निर्धारित')) {
      let hqMatch = prompt.match(/(?:for|in|hq|हेडक्वार्टर)\s+([A-Za-z\u0900-\u097F]+)/i);
      let hq = hqMatch ? hqMatch[1].trim() : 'Indore';
      let amtMatch = prompt.match(/(?:₹|rs\.?|amount|target)\s*[:=]?\s*(\d+)/i) || prompt.match(/(\d{4,})/);
      let targetAmount = amtMatch ? Number(amtMatch[1]) : 500000;

      const action = await executeTool('set_sales_target', {
        headquarterName: hq,
        targetAmount,
        year: new Date().getFullYear(),
      }, adminUser);
      return { reply: action.message, action };
    }

    const action = await executeTool('get_targets_summary', { year: new Date().getFullYear() }, adminUser);
    return { reply: action.message, action };
  }

  // 23. Expenses Intent:
  const isExpense = p.includes('expense') || p.includes('खर्चा') || p.includes('खर्चे') || p.includes('ta/da') || p.includes('tada') || p.includes('claim');
  if (isExpense) {
    const action = await executeTool('get_expenses_summary', {
      timeframe: p.includes('month') || p.includes('महीने') ? 'this_month' : 'today',
    }, adminUser);
    return { reply: action.message, action };
  }

  // 24. Task Assignment Intent:
  const isTask = (p.includes('task') || p.includes('टास्क') || p.includes('assignment') || p.includes('काम')) &&
    (p.includes('add') || p.includes('create') || p.includes('assign') || p.includes('देना') || p.includes('सौंप'));
  if (isTask) {
    let cleanTitle = prompt
      .replace(/(?:task|टास्क|add|create|assign|karo|करो|de\s+do|सौंपो|do)\s+/gi, ' ')
      .trim();
    let mrMatch = prompt.match(/(?:to|ko|को|mr)\s+([A-Za-z\u0900-\u097F]+)/i);
    let mrName = mrMatch ? mrMatch[1].trim() : undefined;

    const action = await executeTool('add_task', {
      title: cleanTitle.slice(0, 80) || 'Priority Field Review',
      mrName,
      priority: 'HIGH',
    }, adminUser);
    return { reply: action.message, action };
  }

  return null;
}

// ── Main OpenRouter AI Agent Service ─────────────────────────────────────────
export const aiAgentService = {
  async processCommand(
    messages: ChatMessage[],
    adminUser: { id: string; role: string; name?: string }
  ): Promise<{
    reply: string;
    actions: AgentActionResult[];
    suggestedActions?: string[];
  }> {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const actionsExecuted: AgentActionResult[] = [];

    const apiKey = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';
    const isApiKeyConfigured = apiKey && apiKey !== 'your_openrouter_api_key_here' && apiKey.startsWith('sk-');
    console.log('[AI Copilot] Processing command:', lastUserMessage);
    console.log('[AI Copilot] isApiKeyConfigured:', isApiKeyConfigured, 'Key length:', apiKey.length);

    // If OpenRouter API key is configured, use full LLM Tool Calling!
    if (isApiKeyConfigured) {
      try {
        const systemPrompt: ChatMessage = {
          role: 'system',
          content: `You are Pharmax Admin Copilot, the fully autonomous executive AI assistant for the Super Admin of the Pharmax Pharmaceutical Field Force Management Portal.
The Super Admin wants to manage the ENTIRE platform directly from this chatbot without ever having to manually open tables, forms, or menus.
You have real-time database tools to execute actions on behalf of the administrator:
- add_doctor: Register a new doctor into a territory/headquarter with specialty, qualification, phone.
- update_doctor: Update an existing doctor's profile (phone, specialty, qualification, HQ, classification).
- delete_doctor: Deactivate or soft-delete a doctor from the system.
- get_doctor_details: Retrieve complete profile and visit history for a specific doctor.
- search_doctors: Search doctors by keyword or territory.
- get_headquarter_doctors_count: Get doctor statistics, count, and specialty breakdown for a headquarter (e.g. Indore, Nagpur, Wardha, etc.) or all headquarters.
- add_product: Add a new pharmaceutical medicine to catalog with MRP, PTR, composition, category, pack size.
- search_products: Search medicine catalog by brand name or composition.
- update_product: Update medicine price (MRP/PTR), composition, or active status.
- add_employee: Onboard a new field workforce member (MR, ASM, RSM) with auto-generated email and default password password123.
- update_employee: Reassign employee territory/HQ, update phone, role, or active status.
- list_field_representatives: List all active field MRs and their territories.
- get_mr_activity_report: Today's field activity and visit stats for a SPECIFIC individual representative by name.
- get_team_activity_report: Get overall team report, total scheduled visits, completed, and live in-clinic calls today.
- add_retailer: Add a new chemist / pharmacy shop with owner, phone, city, HQ, category.
- search_retailers: Search chemists and retail pharmacies by name or HQ.
- add_headquarter: Create a new operating headquarter/territory location.
- list_headquarters: List all operating headquarters/territories with doctor and MR counts.
- assign_visit: Assign/schedule a visit call for an MR to see a doctor or chemist.
- bulk_cancel_visits: Cancel planned visits for any MR on any date (e.g. if planned on wrong route).
- get_orders_summary: Telemetry for secondary sales and orders booked today or this month.
- get_pending_approvals: Check pending doctors, leave requests, and expense claims waiting for approval.
- approve_or_reject_request: Instantly approve or reject a doctor registration, leave, or expense.
- get_dashboard_summary: Field telemetry overview (total visits, completed, in clinic, registered doctors).
- add_hospital: Register a new hospital with bed count, category, city, HQ, contact.
- search_hospitals: Search registered hospitals by name or city.
- add_stockist: Register wholesale distributor / stockist with GSTIN, mobile, city, HQ.
- search_stockists: Search wholesale stockists by name or city.
- get_attendance_summary: Live attendance status (Present, Absent, On Leave, Check-ins) for field team today.
- add_scheme: Create a trade promotional scheme / discount offer for medicines.
- list_schemes: View active trade schemes and promotional slabs.
- get_sample_distribution: Doctor sampling telemetry and representative sample distribution logs.
- get_tour_plans: Review monthly tour plans (MTP/TP) submitted by field representatives.
- approve_tour_plan: Approve or reject a representative's monthly tour plan.
- send_team_broadcast: Send an instant broadcast notice/notification to all field team members.
- set_sales_target: Set annual or monthly revenue sales target (in ₹) for a headquarter/territory.
- get_targets_summary: View sales targets and achievements for headquarters.
- get_expenses_summary: Field expenses claims summary (TA/DA/hotel) today or this month.
- add_task: Assign a priority task or field assignment to an MR or the field team.
- navigate_to_page: Generate direct links to portal pages.

CRITICAL INSTRUCTIONS:
1. When the Super Admin asks you to create, edit, delete, view, or approve ANYTHING, execute the corresponding tool IMMEDIATELY. Infer sensible defaults if minor parameters are not stated.
2. DO NOT tell the Super Admin to visit the admin panel or fill out web forms. You are their autonomous operator.
3. Answer politely and professionally in natural Hindi/Hinglish directly confirming the action taken and presenting the retrieved facts clearly.`,
        };

        const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': env.FRONTEND_URL,
            'X-Title': 'Pharmax Platform Copilot',
          },
          body: JSON.stringify({
            model: env.AI_MODEL || 'openai/gpt-4o-mini',
            messages: [systemPrompt, ...messages],
            tools: AGENT_TOOLS,
            tool_choice: 'auto',
            temperature: 0.3,
          }),
        });

        console.log('[AI Copilot] OpenRouter HTTP status:', response.status);
        if (response.ok) {
          const completionData = await response.json() as any;
          console.log('[AI Copilot] OpenRouter completionData:', JSON.stringify(completionData));
          const choice = completionData.choices?.[0];
          const assistantMsg = choice?.message;

          // Check if OpenRouter requested tool calls
          if (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0) {
            for (const toolCall of assistantMsg.tool_calls) {
              const toolName = toolCall.function?.name;
              let toolArgs = {};
              try {
                toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
              } catch (e) {
                toolArgs = {};
              }

              const result = await executeTool(toolName, toolArgs, adminUser);
              if (result && result.actionType && (result.actionType as string) !== 'NONE' && result.title) {
                actionsExecuted.push(result);
              }
            }

            const primaryAction = actionsExecuted[0];
            let finalReply = primaryAction ? primaryAction.message : (assistantMsg.content || 'Action completed.');

            // Send tool output back to LLM to formulate natural, intelligent Hindi response
            try {
              const followUpMessages = [
                systemPrompt,
                ...messages,
                assistantMsg,
                ...assistantMsg.tool_calls.map((tc: any, idx: number) => ({
                  role: 'tool',
                  tool_call_id: tc.id,
                  name: tc.function?.name,
                  content: JSON.stringify(actionsExecuted[idx]?.data || primaryAction.data || {}),
                })),
              ];

              const followUpRes = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': env.FRONTEND_URL,
                  'X-Title': 'Pharmax Platform Copilot',
                },
                body: JSON.stringify({
                  model: env.AI_MODEL || 'openai/gpt-4o-mini',
                  messages: followUpMessages,
                  temperature: 0.3,
                }),
              });

              if (followUpRes.ok) {
                const followUpData = await followUpRes.json() as any;
                const naturalAnswer = followUpData.choices?.[0]?.message?.content;
                if (naturalAnswer) {
                  finalReply = naturalAnswer;
                }
              }
            } catch (followUpErr) {
              console.warn('[AI Copilot] Follow-up completion failed, using primary action message:', followUpErr);
            }

            return {
              reply: finalReply,
              actions: actionsExecuted,
              suggestedActions: [
                'इन्दौर के डॉक्टर्स दिखाओ',
                'आज की फील्ड समरी बताओ',
                'MR राहुल की आज की रिपोर्ट',
              ],
            };
          }

          // If no tool call was needed (pure Q&A)
          if (assistantMsg?.content) {
            return {
              reply: assistantMsg.content,
              actions: [],
              suggestedActions: [
                'नया डॉक्टर रजिस्टर करो',
                'MR की रिपोर्ट निकालो',
                'आज की फील्ड समरी',
              ],
            };
          }
        }
      } catch (err: any) {
        console.warn('OpenRouter tool calling failed, falling back to local intent parser:', err.message);
      }
    }

    // ── Fallback Engine: Local Smart Intent Parser ──
    const localResult = await parseLocalIntent(lastUserMessage, adminUser);
    if (localResult) {
      if (localResult.action) {
        actionsExecuted.push(localResult.action);
      }
      return {
        reply: localResult.reply,
        actions: actionsExecuted,
        suggestedActions: [
          'डॉक्टर लिस्ट दिखाओ',
          'MR राहुल की रिपोर्ट',
          'आज की फील्ड समरी',
        ],
      };
    }

    // Default guidance response
    return {
      reply: `नमस्ते! मैं आपका **Pharmax Admin Copilot** हूँ। मैं पोर्टल के कई काम सीधे चैट से कर सकता हूँ, जैसे:
- 🩺 **डॉक्टर ऐड करना:** *"Dr. Rajesh Sharma ko Nagpur me add kar do, Cardiology"*
- 📊 **MR की रिपोर्ट निकालना:** *"MR Rahul ki aaj ki report dikhao"*
- 🚫 **विजिट्स बल्क कैंसिल करना:** *"Rahul ki aaj ki saari visits cancel kar do"*
- 🔍 **डॉक्टर खोजना:** *"Cardiologist doctors search karo"*
- 📈 **लाइव ओवरव्यू:** *"Aaj ki field summary dikhao"*

आप मुझे क्या करने का निर्देश देना चाहेंगे?`,
      actions: [],
      suggestedActions: [
        'डॉक्टर राजेश शर्मा को नागपुर में ऐड करो',
        'MR राहुल की आज की रिपोर्ट दिखाओ',
        'आज की फील्ड समरी दिखाओ',
      ],
    };
  },
};
