'use strict';
var Notify = require( 'osg/Notify' );
var Matrix = require( 'osg/Matrix' );
var Vec3 = require( 'osg/Vec3' );


var EllipsoidModel = function () {
    this._radiusEquator = EllipsoidModel.WGS_84_RADIUS_EQUATOR;
    this._radiusPolar = EllipsoidModel.WGS_84_RADIUS_POLAR;
    this.computeCoefficients();
};

EllipsoidModel.WGS_84_RADIUS_EQUATOR = 6378137.0;
EllipsoidModel.WGS_84_RADIUS_POLAR = 6356752.3142;

EllipsoidModel.prototype = {
    setRadiusEquator: function ( radius ) {
        this._radiusEquator = radius;
        this.computeCoefficients();
    },
    getRadiusEquator: function () {
        return this._radiusEquator;
    },
    setRadiusPolar: function ( radius ) {
        this._radiusPolar = radius;
        this.computeCoefficients();
    },
    getRadiusPolar: function () {
        return this._radiusPolar;
    },
    convertLatLongHeightToXYZ: function ( latitude, longitude, height, result ) {
        if ( result === undefined ) {
            Notify.warn( 'deprecated, use this signature convertLatLongHeightToXYZ( latitude, longitude, height, result )' );
            result = Vec3.create();
        }
        var sinLatitude = Math.sin( latitude );
        var cosLatitude = Math.cos( latitude );
        var N = this._radiusEquator / Math.sqrt( 1.0 - this._eccentricitySquared * sinLatitude * sinLatitude );
        var X = ( N + height ) * cosLatitude * Math.cos( longitude );
        var Y = ( N + height ) * cosLatitude * Math.sin( longitude );
        var Z = ( N * ( 1.0 - this._eccentricitySquared ) + height ) * sinLatitude;
        result[ 0 ] = X;
        result[ 1 ] = Y;
        result[ 2 ] = Z;
        return result;
    },
    convertXYZToLatLongHeight: function ( X, Y, Z, result ) {
        if ( result === undefined ) {
            Notify.warn( 'deprecated, use this signature convertXYZToLatLongHeight( X,  Y,  Z , result)' );
            result = Vec3.create();
        }
        // http://www.colorado.edu/geography/gcraft/notes/datum/gif/xyzllh.gif
        var p = Math.sqrt( X * X + Y * Y );
        var theta = Math.atan2( Z * this._radiusEquator, ( p * this._radiusPolar ) );
        var eDashSquared = ( this._radiusEquator * this._radiusEquator - this._radiusPolar * this._radiusPolar ) / ( this._radiusPolar * this._radiusPolar );

        var sinTheta = Math.sin( theta );
        var cosTheta = Math.cos( theta );

        var latitude = Math.atan( ( Z + eDashSquared * this._radiusPolar * sinTheta * sinTheta * sinTheta ) /
            ( p - this._eccentricitySquared * this._radiusEquator * cosTheta * cosTheta * cosTheta ) );
        var longitude = Math.atan2( Y, X );

        var sinLatitude = Math.sin( latitude );
        var N = this._radiusEquator / Math.sqrt( 1.0 - this._eccentricitySquared * sinLatitude * sinLatitude );

        var cosLat = Math.cos( latitude );
        if ( cosLat === 0 ) cosLat = 1;
        var height = p / cosLat - N;
        result[ 0 ] = latitude;
        result[ 1 ] = longitude;
        result[ 2 ] = height;
        return result;
    },
    computeLocalUpVector: function ( X, Y, Z ) {
        // Note latitude is angle between normal to ellipsoid surface and XY-plane
        var latitude, longitude, altitude;
        var coord = this.convertXYZToLatLongHeight( X, Y, Z, latitude, longitude, altitude );
        latitude = coord[ 0 ];
        longitude = coord[ 1 ];
        altitude = coord[ 2 ];

        // Compute up vector
        return [ Math.cos( longitude ) * Math.cos( latitude ),
            Math.sin( longitude ) * Math.cos( latitude ),
            Math.sin( latitude )
        ];
    },
    isWGS84: function () {
        return ( this._radiusEquator === EllipsoidModel.WGS_84_RADIUS_EQUATOR && this._radiusPolar === EllipsoidModel.WGS_84_RADIUS_POLAR );
    },

    computeCoefficients: function () {
        var flattening = ( this._radiusEquator - this._radiusPolar ) / this._radiusEquator;
        this._eccentricitySquared = 2.0 * flattening - flattening * flattening;
    },
    computeLocalToWorldTransformFromLatLongHeight: function ( latitude, longitude, height, result ) {
        if ( result === undefined ) {
            Notify.warn( 'deprecated, use this signature computeLocalToWorldTransformFromLatLongHeight(latitude, longitude, height, result)' );
            result = Matrix.create();
        }
        var pos = this.convertLatLongHeightToXYZ( latitude, longitude, height, result );
        Matrix.makeTranslate( pos[ 0 ], pos[ 1 ], pos[ 2 ], result );
        this.computeCoordinateFrame( latitude, longitude, result );
        return result;
    },
    computeLocalToWorldTransformFromXYZ: function ( X, Y, Z ) {
        var lla = this.convertXYZToLatLongHeight( X, Y, Z );
        var m = Matrix.makeTranslate( X, Y, Z, Matrix.create() );
        this.computeCoordinateFrame( lla[ 0 ], lla[ 1 ], m );
        return m;
    },
    computeCoordinateFrame: ( function () {
        var up = Vec3.create();
        var east = Vec3.create();
        var north = Vec3.create();
        return function ( latitude, longitude, localToWorld ) {
            // Compute up vector
            up[ 0 ] = Math.cos( longitude ) * Math.cos( latitude );
            up[ 1 ] = Math.sin( longitude ) * Math.cos( latitude );
            up[ 2 ] = Math.sin( latitude );

            // Compute east vector
            east[ 0 ] = -Math.sin( longitude );
            east[ 1 ] = -Math.cos( longitude );

            // Compute north vector = outer product up x east
            Vec3.cross( up, east, north );

            // set matrix
            Matrix.set( localToWorld, 0, 0, east[ 0 ] );
            Matrix.set( localToWorld, 0, 1, east[ 1 ] );
            Matrix.set( localToWorld, 0, 2, east[ 2 ] );

            Matrix.set( localToWorld, 1, 0, north[ 0 ] );
            Matrix.set( localToWorld, 1, 1, north[ 1 ] );
            Matrix.set( localToWorld, 1, 2, north[ 2 ] );

            Matrix.set( localToWorld, 2, 0, up[ 0 ] );
            Matrix.set( localToWorld, 2, 1, up[ 1 ] );
            Matrix.set( localToWorld, 2, 2, up[ 2 ] );
        };
    } )()
};

module.exports = EllipsoidModel;
