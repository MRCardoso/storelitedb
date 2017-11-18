/*
| --------------------------------------------------------------------
| REQUIRED  
| --------------------------------------------------------------------
*/
const gulp      = require('gulp');
const uglify    = require('gulp-uglify');
const rename    = require('gulp-rename');
const concat    = require('gulp-concat');
const clean     = require('gulp-clean');
const watch     = require('gulp-watch');

/*
| --------------------------------------------------------------------
| GENERATE SCRIPTS COMPLETED
| --------------------------------------------------------------------
*/
gulp.task('scripts-prod',[], function() {
    return gulp.src(['src/**/*.js'])
        .pipe(concat('storelitedb.js'))
        .pipe(gulp.dest('dist/js'))
        .pipe(gulp.dest('../../ionic/wallpaper/www/js/services'))
        .pipe(uglify())
        .pipe(rename('storelitedb.min.js'))
        .pipe(gulp.dest('dist/js'));
});

/*
| --------------------------------------------------------------------
| WATCH THE FILE CHANGES
| --------------------------------------------------------------------
*/
gulp.task('watch', function () {
    // Endless stream mode 
    gulp.watch('src/**/*.js', ['scripts-prod']);
});

/*
| --------------------------------------------------------------------
| DFAULT TASK  
| --------------------------------------------------------------------
*/
gulp.task('default', ['scripts-prod'], function(){});