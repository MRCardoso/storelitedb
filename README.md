# Database local in client side

## Create a database
Start your table in local database, create table when nos exists else on return the db instance
```Javascript
angular.module('your-app')
    .controller('YourController', ['$scope', 'Database', function($scope, Database){
        // costumize your database name, size e another configurations availables
        Database.setConnectionOptions({
            showLogs: 'enable the logs',// default true 
            storageType: 'storage type', // default and unique sqlite 
            dbName: 'your db name', // default custom.db
            dbSize: 'size of your webSql db'// default 5MB
        });
        
        // Boot the database, open connection with db
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
