# Database local in client side

## Config your db
costumize your database name, size e another configurations availables
```Javascript
angular.module('your-app'[])
    .run(function(DBUtil){
        DBUtil.setObject('db.config', {
            showLogs: 'enable the logs',// default true 
            storageType: 'storage type', // default and unique sqlite 
            dbName: 'your db name', // default custom.db
            dbSize: 'size of your webSql db'// default 5MB
        });
    });
```

## Create a database
Start your table in local database, create table when nos exists else on return the db instance
```Javascript
angular.module('your-app')
    .controller('YourController', ['$scope', 'Database', function($scope, Database){
        Database.initialize({
            tableName: 'your table name',
            columns: 'a object({name: dataType}) with fields of this table'
        }).then(function(instance){
            db = instance;
        }, function(e){
            // fail message
        });
    }]);
```