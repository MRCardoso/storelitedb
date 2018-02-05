/**
 * storelitedb - AngularJS module with work with client side database with sqlite and webSql
 * 
 * Copyright 2017 Marlon R Cardoso <marlonrcardoso@yahoo.com.br>
 */
(function(){
    'use strict';
    angular.module('storelitedb',[])
    .run(["$rootScope", function($rootScope){
    }]);
}());
angular.module('storelitedb')
.constant("DBConfig", {
    showLogs: true,
    storageType: 'sqlite',
    dbName: 'custom.db',
    dbSize: (5*1024*1024)
});
angular.module('storelitedb')
.service('Database', ['$q', 'DBConfig', 'DBUtil', 'Log', 'Loading', function($q, DBConfig, DBUtil, Log, Loading)
    {
        var db = null;
        var queryString = '';
        var prepareArray = [];
        /**
         * The default configurations of the database(eg: name,size)
         * @var {object} config
         * @var {string} [config.dbName=custom.db] The name of the database
         * @var {int} [config.dbSize=(5*1024*1024)] The size of the database
         * @var {bool} [config.showLogs=true] The enable disable the logs of the command sql
         * @var {string} [config.storageType=sqlite] the storage type(only sqlite implemented here)
         */
        var config = DBConfig;

        /**
         * execute the query command sent in first argument
         * @param {string} sql the string with the query to be executed
         * @param {array} attributes the array of argument to be prepare and replaced in '?' character of the sql
         */
        function query(sql, attributes)
        {
            attributes = (attributes || []);
            return $q(function(resolve, reject){
                db.transaction(function (t){
                    t.executeSql(sql, attributes, function (tx, r) {
                        Log.success('Query: '+sql, [r, attributes], config.showLogs);
                        return resolve(r);
                    }, function (tx, e) {
                        if( window.cordova ){
                            window.plugins.toast.show("The query had an error", 'long', 'top');
                        }
                        Log.DBException(e, sql, attributes, config.showLogs);
                        reject(e);
                    });
                });
            });
        }
        
        /**
         * Set the custom configuration for the databse
         * @param {Object} value The object with db config
         * @param {string} value.dbName The name of the database
         * @param {int} value.dbSize The size of the database
        */
        this.setConnectionOptions = function (value) {
            config = angular.extend(DBConfig, ( value || {} ));
        };

        /**
         * Start the connection in the databse(WebSql or Sqlite)
         * @return Database
         */
        this.connect = function()
        {
            if( db == null )
            {
                if( window.sqlitePlugin ){
                    db = window.sqlitePlugin.openDatabase({name: config.dbName, location: 'default'});
                    Log.info('sqlite.connection', db, config.showLogs);
                } else{
                    db = window.openDatabase(config.dbName, "1.0", "Test Web SQL Database", config.dbSize);
                    Log.info('WebSql.connection', db, config.showLogs);
                }
            }
            else{
                Log.info('cache.connection', db, config.showLogs);
            }
            return this;
        };

        /**
         * @example Database.initialize({tableName:'dbz', columns: {id: 'INTEGER PRIMARY KEY AUTOINCREMENT'}});
         * @param {object} schema the data of the table to be create
         */
        this.initialize = function(schema)
        {
            var defer = $q.defer();
            if( db == null ){
                Log.info('connect.db', undefined, config.showLogs);
                var instance = this.connect();
                var sql = "SELECT sql FROM sqlite_master WHERE tbl_name = '{tableName}' AND type = 'table'";
                sql = sql.replace('{tableName}', schema.tableName);
    
                query(sql).then(function(r){
                    if( r.rows.length  == 0 ){
                        Log.info('creating.db', schema, config.showLogs);
                        instance.create(schema.tableName, schema.columns).then(function(){
                            return defer.resolve(instance);
                        }, function(e){
                            Log.DBException(e, schema, config.showLog);
                            defer.reject(e);
                        });
                    }
                    else{
                        Log.info('loading.db', schema, config.showLogs);
                        return defer.resolve(instance);
                    }
                }, function(e){
                    Log.DBException(e, sql);
                    defer.reject(e);
                });
            }
            else{
                Log.info('cached.db');
                defer.resolve(db);
            }
            
            return defer.promise;
        };

        /**
         * Create a table in local database
         * @example db.create('dbz', {personagem: 'TEXT'});
         * @param {string} tableName the name of the table to be create
         * @param {object} fields the object with the field of the table
         * @param {boolean} notExists set rule in create sql
         * @return Promise
         */
        this.create = function(tableName, fields, notExists){
            notExists = (angular.isUndefined(notExists) ? 'IF NOT EXISTS' : '');
            
            var fieldList = DBUtil.prepareFields(fields, 'create');
            var sql = "CREATE TABLE {notExist} {tableName} ({fields});"
                    .replace('{tableName}', tableName)
                    .replace('{notExist}', notExists)
                    .replace('{fields}', fieldList.field);

            return query(sql, []);
        };

        /**
         * @param {string} tableName the name of the table
         * @param {boolean} notExists with exists rule
         */
        this.drop = function(tableName, notExists){
            notExists = (angular.isUndefined(notExists) ? 'IF EXISTS ' : '');
            return query("DROP TABLE "+notExists+tableName, []);
        };

        /**
         * Insert a record in the specific table in local database
         * @example db.insert('dbz', {personagem: 'Kakaroto'});
         * @param {string} tableName the name of the table to be create
         * @param {object} fields the object with the field of the table
         * @return Promise
         */
        this.insert = function(tableName, fields){
            var fieldList = DBUtil.prepareFields(fields, 'insert');
            var sql = "INSERT INTO {tableName} ({fields}) values({values})";
            
            sql = sql.replace('{tableName}', tableName)
                    .replace('{fields}', fieldList.field.join(','))
                    .replace('{values}', fieldList.field.map(function(row){ return '?'}) );
            
            return query(sql, fieldList.values);
        };

        /**
         * Update the data of a specific table in local database
         * @example db.update('dbz', {personagem: 'Son Goku'}, {id:1});
         * @param {string} tableName the name of the table to be create
         * @param {object} values the fields to be updated
         * @param {object} condition the rules of the update a data
         * @return Promise
         */
        this.update = function(tableName, values, condition){
            var fieldList = DBUtil.prepareFields(values, 'update');
            var conditions = DBUtil.prepareConditions(condition);
            var sql = "UPDATE {tableName} SET {fields} WHERE {condition};";
            
            sql = sql.replace('{tableName}', tableName)
                    .replace('{fields}', fieldList.field.join(','))
                    .replace('{condition}', conditions.rules.join(" AND ") );
            
            return query(sql, fieldList.values.concat(conditions.values));
        };

        /**
         * Update the data of a specific table in local database
         * @example db.delete('dbz', {id:1});
         * @param {string} tableName the name of the table to be create
         * @param {object} condition the rules of the update a data
         * @return Promise
         */
        this.remove = function(tableName, condition){
            var fieldList = DBUtil.prepareConditions(condition);
            var sql = "DELETE FROM "+tableName;
            if( angular.isDefined(condition) ){
                sql += " WHERE "+(fieldList.rules.join(" AND "))+";";
            }
            return query(sql, fieldList.values);
        };
        
        /**
         * add the 'select' command in the query to be executed
         * @param {object} fields the list of the fields to be return in query
         * @return Database
         */
        this.select = function(fields){
            queryString = "SELECT "+fields.join(', ');
            return this;
        };
        
        /**
         * add the 'from' command in the query to be executed
         * @param {string} tableName the name of the table
         * @return Database
         */
        this.from = function(tableName){
            queryString += " FROM "+tableName;
            return this;
        };

        /**
         * add the 'where' command in the query to be executed
         * @param {object} condition the rules to be add in the query
         * @return Database
         */
        this.where = function(condition){
            var fieldList = DBUtil.prepareConditions(condition);
            queryString += (" WHERE "+fieldList.rules.join(" AND "));
            prepareArray = fieldList.values;

            return this;
        };

        /**
         * return all result of the query stored in 'queryString'
         * @return Promise
         */
        this.all = function(){
            return $q(function(resolve, reject){
                if(queryString == ''){
                    return reject('no query found');
                }
                
                query(queryString, prepareArray).then(function(r){
                    queryString = null;
                    prepareArray = [];
                    var data = [];
                    for (var i = 0; i < r.rows.length; i++){
                        data.push(r.rows.item(i));
                    }
                    resolve(data);
                }, function(e){
                    reject(e);
                });
            });
        };

        /**
         * return one result of the query stored in 'queryString'
         * @return Promise
         */
        this.one = function(){
            return $q(function(resolve, reject){
                if(queryString == ''){
                    return reject('no query found');
                }
                query(queryString+" LIMIT 1", prepareArray).then(function(r){
                    queryString = null;
                    prepareArray = [];
                    if( r.rows.length == 0 )
                        reject('no result found');
                    else
                        resolve(r.rows.item(0));
                }, function(e){
                    reject(e);
                });
            });
        };
    }])
angular.module('storelitedb')
.factory('DBUtil', function()
{   
    function set(key, value){
        localStorage.setItem(key, value);
    }
    function get(key)
    {
        return localStorage.getItem(key);
    }

    function setObject(key, value)
    {
        set(key, angular.toJson(value));
    }
    function getObject(key)
    {
        return angular.fromJson(get(key));
    }
    /**
     * prepare the rules of the query to be executed
     * @param {object} conditions the rules use in the with in update, delete and select
     * @return Object {values:[], rules:{}}
     */
    function prepareConditions(conditions)
    {
        var arrayList = {values: [], rules: []};
        for( var c in conditions ){
            var compare = '= ?';
            if(typeof conditions[c] == 'object'){
                compare = conditions[c].operator;
                switch(compare.toLowerCase()){
                    case 'in':
                    case 'not in':
                    case 'between':
                        value = conditions[c].value.map(function(op){ 
                            arrayList.values.push(op);
                            return '?';
                        }).join(compare.toLowerCase() =='between' ? ' AND ':',');
                        compare = ( compare.toLowerCase() =='between' ? (compare+' '+value): (compare+'('+value+')'));
                        break;
                    default: 
                        arrayList.values.push(conditions[c].value);
                        compare = compare+' ?';
                        break;
                }
            }
            else{
                arrayList.values.push(conditions[c]);
            }
            arrayList.rules.push(c+' '+compare);
        }
        return arrayList;
    }
    /**
     * prepare the field in create, insert, update, delete and select query
     * with the pattern of each sql command
     * @param {object} arrayField the list of the field to be add in the query
     * @param {string} type the type of query to prepare the sql standard with columns, rules, etc...
     * @param {object} conditions the rules use in the with in update, delete and select
     * @return Object {values:[], field:{}, conditions:{}}
     */
    function prepareFields(arrayField, type){
        var arrayList = {field: [], values: []};
        for(var i in arrayField)
        {
            arrayList.values.push(arrayField[i]);
            
            switch(type){
                case 'create': 
                    arrayList.field.push(i+" "+arrayField[i]);
                    break;
                case 'insert': 
                    arrayList.field.push(i);
                    break;
                case 'update':
                    arrayList.field.push(i+" = ?");
                    break;
            }
        }
        return arrayList;
    }
    return {
        prepareFields: prepareFields,
        prepareConditions: prepareConditions,
        get: get,
        set: set,
        setObject: setObject,
        getObject: getObject
    }
})