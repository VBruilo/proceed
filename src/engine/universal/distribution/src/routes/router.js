const processStorageRoutes = require('./ProcessStorageRoutes');
const processInstanceRoutes = require('./ProcessInstanceRoutes');
const htmlRoutes = require('./HtmlRoutes');
const statusRoutes = require('./StatusRoutes');
const resourcesRoutes = require('./ResourcesRoutes');

module.exports = (management) => {
  processStorageRoutes('/process', management);
  processInstanceRoutes('/process', management);
  htmlRoutes('/process');
  statusRoutes('/status');
  resourcesRoutes('/resources');
};
