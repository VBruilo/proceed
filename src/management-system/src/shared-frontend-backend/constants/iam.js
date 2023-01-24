// permissions bitmap
const PERMISSION_NONE = 0;
const PERMISSION_VIEW = 1;
const PERMISSION_UPDATE = 2;
const PERMISSION_CREATE = 4;
const PERMISSION_DELETE = 8;
const PERMISSION_MANAGE = 16;
const PERMISSION_SHARE = 32;
const PERMISSION_MANAGE_ROLES = 64;
const PERMISSION_MANAGE_GROUPS = 128;
const PERMISSION_MANAGE_PASSWORD = 256;
const PERMISSION_ADMIN = 9007199254740991;

// permission mapping to verbs
const PERMISSION_MAPPING = {
  none: PERMISSION_NONE,
  view: PERMISSION_VIEW,
  update: PERMISSION_UPDATE,
  create: PERMISSION_CREATE,
  delete: PERMISSION_DELETE,
  manage: PERMISSION_MANAGE,
  share: PERMISSION_SHARE,
  'manage-roles': PERMISSION_MANAGE_ROLES,
  'manage-groups': PERMISSION_MANAGE_GROUPS,
  'manage-password': PERMISSION_MANAGE_PASSWORD,
  admin: PERMISSION_ADMIN,
};

// share types
const TYPE_USER = 0;
const TYPE_GROUP = 1;
const TYPE_LINK = 2;

module.exports = {
  PERMISSION_NONE,
  PERMISSION_VIEW,
  PERMISSION_UPDATE,
  PERMISSION_CREATE,
  PERMISSION_DELETE,
  PERMISSION_MANAGE,
  PERMISSION_SHARE,
  PERMISSION_MANAGE_ROLES,
  PERMISSION_MANAGE_GROUPS,
  PERMISSION_MANAGE_PASSWORD,
  PERMISSION_ADMIN,
  PERMISSION_MAPPING,
  TYPE_USER,
  TYPE_GROUP,
  TYPE_LINK,
};
