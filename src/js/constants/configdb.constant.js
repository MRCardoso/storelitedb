angular.module('storelitedb')
.constant("DBConfig", {
    showLogs: true,
    storageType: 'sqlite',
    dbName: 'custom.db',
    dbSize: (5*1024*1024)
});