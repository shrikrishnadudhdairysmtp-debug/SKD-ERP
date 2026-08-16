/**
 * Default permission sets by role.
 * Used when creating new users and as a reference for the frontend.
 */

export const DEFAULT_PERMISSIONS = {
  ADMIN: {
    pages: {
      overview: true,
      analytics: true,
      transactions: true,
      approvals: true,
      ledger: true,
      parties: true,
      loans: true,
      users: true,
    },
    actions: {
      createTransactions: true,
      approveReject: true,
      deleteTransactions: true,
      manageParties: true,
      downloadReports: true,
    },
  },
  CHECKER: {
    pages: {
      overview: true,
      analytics: true,
      transactions: true,
      approvals: true,
      ledger: true,
      parties: true,
      loans: true,
      users: false,
    },
    actions: {
      createTransactions: true,
      approveReject: true,
      deleteTransactions: true,
      manageParties: true,
      downloadReports: true,
    },
  },
  MAKER: {
    pages: {
      overview: true,
      analytics: true,
      transactions: true,
      approvals: false,
      ledger: true,
      parties: true,
      loans: true,
      users: false,
    },
    actions: {
      createTransactions: true,
      approveReject: false,
      deleteTransactions: true,
      manageParties: true,
      downloadReports: true,
    },
  },
  VIEWER: {
    pages: {
      overview: true,
      analytics: true,
      transactions: true,
      approvals: false,
      ledger: true,
      parties: false,
      loans: true,
      users: false,
    },
    actions: {
      createTransactions: false,
      approveReject: false,
      deleteTransactions: false,
      manageParties: false,
      downloadReports: false,
    },
  },
};

/**
 * Returns a deep copy of the default permissions for a given role.
 */
export function getDefaultPermissions(role) {
  const perms = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.VIEWER;
  return JSON.parse(JSON.stringify(perms));
}
