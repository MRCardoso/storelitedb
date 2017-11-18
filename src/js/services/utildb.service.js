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