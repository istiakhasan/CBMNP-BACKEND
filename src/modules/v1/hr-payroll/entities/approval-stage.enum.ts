// Shared two-step approval chain used by Leave, Expense Claims, Overtime Requests and
// Attendance Corrections: the employee's Department Head decides first, then a
// designated Final Approver (e.g. CCO/CEO) gives the last sign-off.
export enum ApprovalStage {
  PENDING_DEPT_HEAD = 'PendingDeptHead',
  PENDING_FINAL = 'PendingFinalApproval',
}
