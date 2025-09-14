import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Graphics variables
let container, stats, gui;
let camera, controls, scene, renderer;
let textureLoader;
let btn;
const clock = new THREE.Clock();
let clickRequest = false;
const mouseCoords = new THREE.Vector2();
let score = 0;
// const raycaster = new THREE.Raycaster();
// const ballMaterial = new THREE.MeshPhongMaterial( { color: 0x202020 } );
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();

let groundMesh = null;
const holeInfo = { center: new THREE.Vector2(), radius: 0, topY: 0 };
let groundBounds = null;
let rectMesh; 
const ballRadius = 0.4;
const ballMass = 4.593;
const playerOrigin = new THREE.Vector3( 0, 0, 0 );
const obstacles = [];
const params = { 
	power: 10,
	angle: 0,
	elevation: 5
}

// Physics variables
const gravityConstant = - 9.8;
let physicsWorld;
const rigidBodies = [];
const softBodies = [];
const margin = 0.05;
let transformAux1;
let softBodyHelpers;


const colGroup = 1;
const colGroupBall = 1 << 1;
const colGroupStatic = 1 << 2;

if ( typeof Ammo === 'function' ) {

    Ammo().then( function ( AmmoLib ) {

        Ammo = AmmoLib;
        init();

    } );

} else if ( typeof Ammo === 'object' && Ammo !== null ) {
    init();

} else {
    const ammoInterval = setInterval( function () {

        if ( typeof Ammo === 'function' ) {

            clearInterval( ammoInterval );

            Ammo().then( function ( AmmoLib ) {

                Ammo = AmmoLib;
                init();

            } );

        } else if ( typeof Ammo === 'object' && Ammo !== null ) {

            clearInterval( ammoInterval );
            init();

        }

    }, 50 );

}

function init() {

    initGraphics();

    initPhysics();

    createObjects();

    initInput();

    if ( renderer ) renderer.setAnimationLoop( animate );

}

function initGraphics() {
    const container = document.getElementById( 'container' );

    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.2, 2000 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xbfd1e5 );

    camera.position.set( - 7, 5, 8 );

    renderer = new THREE.WebGLRenderer( { antialias: true } );

    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
	container.appendChild( renderer.domElement );
    controls = new OrbitControls( camera, renderer.domElement );
    controls.target.set( 0, 2, 0 );
    controls.update();

    textureLoader = new THREE.TextureLoader();

    const ambientLight = new THREE.AmbientLight( 0xbbbbbb );
    scene.add( ambientLight );

    const light = new THREE.DirectionalLight( 0xffffff, 3 );
    light.position.set( - 10, 10, 5 );
    light.castShadow = true;
    const dist = 20;
    light.shadow.camera.left = - dist;
    light.shadow.camera.right = dist;
    light.shadow.camera.top = dist;
    light.shadow.camera.bottom = - dist;
    light.shadow.camera.near = 2;
    light.shadow.camera.far = 50;
    light.shadow.mapSize.set( 1024, 1024 );
    scene.add( light );

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';

	container.appendChild( stats.domElement );

    window.addEventListener( 'resize', onWindowResize );
	btn = createShootBtn();
    Object.assign(btn.style, {
        position: 'fixed',
        left: '50%',
        bottom: '64px',
        transform: 'translateX(-50%)',
        padding: '28px 56px',
        fontSize: '42px',
		fontFamily: 'Roboto, Arial, sans-serif',
        zIndex: 1000,
        borderRadius: '8px',
        border: 'none',
        background: '#1e88e5',
        color: '#fff',
        cursor: 'pointer',
    });
    btn.addEventListener('click', shootBall);
    document.body.appendChild(btn);
}

function createShootBtn() {
	const b = document.createElement('button');
	b.textContent = 'Shoot';
	return b;
}

function initPhysics() {

	const collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
	const dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
	const broadphase = new Ammo.btDbvtBroadphase();
	const solver = new Ammo.btSequentialImpulseConstraintSolver();
	const softBodySolver = new Ammo.btDefaultSoftBodySolver();
	physicsWorld = new Ammo.btSoftRigidDynamicsWorld( dispatcher, broadphase, solver, collisionConfiguration, softBodySolver );
	physicsWorld.setGravity( new Ammo.btVector3( 0, gravityConstant, 0 ) );
	physicsWorld.getWorldInfo().set_m_gravity( new Ammo.btVector3( 0, gravityConstant, 0 ) );

	transformAux1 = new Ammo.btTransform();
	softBodyHelpers = new Ammo.btSoftBodyHelpers();

}

function createObjects() {

	// Ground
	pos.set( 0, - 0.5, 0 );
	quat.set( 0, 0, 0, 1 );
	// const ground = createParalellepiped( 40, 1, 40, 0, pos, quat, new THREE.MeshPhongMaterial( { color: 0xFFFFFF } ) );
	// ground.castShadow = true;
	// ground.receiveShadow = true;
	// textureLoader.load( 'textures/grid.png', function ( texture ) {

	// 	texture.colorSpace = THREE.SRGBColorSpace;
	// 	texture.wrapS = THREE.RepeatWrapping;
	// 	texture.wrapT = THREE.RepeatWrapping;
	// 	texture.repeat.set( 40, 40 );
	// 	ground.material.map = texture;
	// 	ground.material.needsUpdate = true;

	// } );

	// Create soft volumes
	const volumeMass = 15;

	// const sphereGeometry = new THREE.SphereGeometry( 1.5, 40, 25 );
	// sphereGeometry.translate( 5, 5, 0 );
	// createSoftVolume( sphereGeometry, volumeMass, 250 );

	// const boxGeometry = new THREE.BoxGeometry( 1, 1, 5, 4, 4, 20 );
	// boxGeometry.translate( - 2, 5, 0 );
	// createSoftVolume( boxGeometry, 0, 120 );
	
	pos.set( 0, -0.5, 0 );
	quat.set( 0, 0, 0, 1);
    const outer = new THREE.Shape();
    outer.moveTo( -20, -20 );
    outer.lineTo( 20, -20 );
    outer.lineTo( 20, 20 );
    outer.lineTo( -20, 20 );
	outer.closePath();

	const holeRadius = 0.45;
	const hole = new THREE.Path();
	const holeOffsetX = 7.5;
	const holeOffsetY = 7.5;
	const max = 10
	const min = -25
	const holeCenterX = Math.floor(Math.random() * (max - min) + min) + holeOffsetX;
	const holeCenterY = Math.floor(Math.random() * (max - min) + min) + holeOffsetY;

	hole.absarc( holeCenterX, holeCenterY, holeRadius, 0, Math.PI * 2, false );
	outer.holes.push(hole);

	holeInfo.radius = holeRadius;
    holeInfo.center.set( holeCenterX, holeCenterY );

	const extrusionSettings = { depth: 1, bevelEnabled: false, curveSegments: 24 };
    const groundGeom = new THREE.ExtrudeGeometry( outer, extrusionSettings );
    groundGeom.computeVertexNormals();
    groundGeom.computeBoundingBox();


	const groundMat = new THREE.MeshPhongMaterial( { color: 0xFFFFFFF } );
	const ground = new THREE.Mesh( groundGeom, groundMat );
    ground.castShadow = true;
	ground.receiveShadow = true;
	ground.position.set( pos.x, pos.y, pos.z );
	ground.rotation.set( Math.PI / 2, 0, 0 );
    scene.add( ground );

	groundMesh = ground;
	holeInfo.topY = new THREE.Box3().setFromObject( ground ).max.y;
	groundBounds = new THREE.Box3().setFromObject( ground );
	playerOrigin.set( 0, holeInfo.topY + ballRadius + 0.02, 0 );

	{
		const marker = new THREE.Mesh(
            new THREE.CylinderGeometry( 0.15, 0.15, 0.02, 20 ),
            new THREE.MeshBasicMaterial( { color: 0xD22B2B } )
		);
		marker.position.set( playerOrigin.x, holeInfo.topY + 0.01, playerOrigin.z );
		scene.add( marker );
	}

    const rectHeight = 2.5;
    const rectGeometry = new THREE.BoxGeometry( 0.2, rectHeight, 0.2, 1, 1, 1 );
    const rectMat = new THREE.MeshPhongMaterial( { color: 0x2E96FF } );
    rectMesh = new THREE.Mesh( rectGeometry, rectMat );
    // rectMesh.castShadow = true;
    rectMesh.receiveShadow = true;
    rectMesh.position.set( holeCenterX, holeInfo.topY + rectHeight * 0.8, holeCenterY );
	rectMesh.userData.baseY = rectMesh.position.y;
    rectMesh.userData.bob = { amplitude: 0.35, speed: 2.0 };
	scene.add( rectMesh );

	textureLoader.load( 'images/grid.png', function ( texture ) {
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		const bb = groundGeom.boundingBox;
		const width = bb.max.x - bb.min.x;
		const height = bb.max.y - bb.min.y;
		const tileSize = 40;
		texture.repeat.set( Math.max(1, width / tileSize), Math.max(1, height / tileSize) );
		ground.material.map = texture;
		ground.material.needsUpdate = true;
	} );

    const triangleMesh = new Ammo.btTriangleMesh();
    const posAttr = groundGeom.attributes.position.array;
    const indexAttr = groundGeom.index ? groundGeom.index.array : null;

    const _v = ( x, y, z ) => new Ammo.btVector3( x, y, z );

    if ( indexAttr ) {
        for ( let i = 0; i < indexAttr.length; i += 3 ) {
            const a = indexAttr[ i ] * 3;
            const b = indexAttr[ i + 1 ] * 3;
            const c = indexAttr[ i + 2 ] * 3;
            const va = _v( posAttr[ a ], posAttr[ a + 1 ], posAttr[ a + 2 ] );
            const vb = _v( posAttr[ b ], posAttr[ b + 1 ], posAttr[ b + 2 ] );
            const vc = _v( posAttr[ c ], posAttr[ c + 1 ], posAttr[ c + 2 ] );
            triangleMesh.addTriangle( va, vb, vc, true );
        }
    } else {
        for ( let i = 0; i < posAttr.length; i += 9 ) {
            const va = _v( posAttr[ i ], posAttr[ i + 1 ], posAttr[ i + 2 ] );
            const vb = _v( posAttr[ i + 3 ], posAttr[ i + 4 ], posAttr[ i + 5 ] );
            const vc = _v( posAttr[ i + 6 ], posAttr[ i + 7 ], posAttr[ i + 8 ] );
            triangleMesh.addTriangle( va, vb, vc, true );
        }
    }

    const triMeshShape = new Ammo.btBvhTriangleMeshShape( triangleMesh, true, true );
    triMeshShape.setMargin( 0 );

    const groundBody = createRigidBody(
        ground,
        triMeshShape,
        0,
        ground.position,
        ground.quaternion,
        colGroupStatic,
        colGroupBall | colGroup // collide with balls (and any default)
    );
	groundBody.setFriction( 1.0 );
	groundBody.setRollingFriction( 1.0 );
	// Ramp
	// pos.set( 3, 1.5, 0 );
	// quat.setFromAxisAngle( new THREE.Vector3( 0, 0, 1 ), 30 * Math.PI / 180 );
	// const obstacle = createParalellepiped( 10, 1, 4, 0, pos, quat, new THREE.MeshPhongMaterial( { color: 0x606060 } ) );
	// obstacle.castShadow = true;
	// obstacle.receiveShadow = true;

	gui = new GUI();
    const playerFolder = gui.addFolder( 'Player' );
    playerFolder.add( params, 'power', 0, 50, 0.1 );
    playerFolder.add( params, 'angle', -360, 360, 1 );
    playerFolder.add( params, 'elevation', -180, 180, 1 );

    const courseFolder = gui.addFolder( 'Course' );
	    const courseParams = {
        count: 25,
        minLen: 2,
        maxLen: 8,
        height: 1,
        depth: 0.3,
        edgePad: 0.5,
        holeClear: 1.0,
        centerClear: 1.5
    };
    courseFolder.add( courseParams, 'count', 1, 150, 1 );
    courseFolder.add( courseParams, 'minLen', 0.5, 20, 0.1 );
    courseFolder.add( courseParams, 'maxLen', 0.5, 20, 0.1 );
    courseFolder.add( courseParams, 'height', 0.2, 3, 0.1 );
    courseFolder.add( courseParams, 'depth', 0.1, 2, 0.05 );
    courseFolder.add( courseParams, 'edgePad', 0, 2, 0.05 );
    courseFolder.add( courseParams, 'holeClear', 1, 3, 0.05 );
    courseFolder.add( courseParams, 'centerClear', 1, 3, 0.05 );
    courseFolder.add( { random: () => { clearWalls(); addRandomWalls( courseParams.count, courseParams ); } }, 'random' ).name( 'Generate random obstacles' );
    courseFolder.add( { clear: clearWalls }, 'clear' ).name( 'Clear obstacles' )

}

function addRandomWalls( count = 10, opts = {} ) {
    if ( !groundBounds ) return;
    const {
        minLen = 2, maxLen = 8,
        height = 1, depth = 0.3,
        edgePad = 0.5,
        holeClear = 1.0,
        centerClear = 1.5
    } = opts;

    const minX = groundBounds.min.x + edgePad;
    const maxX = groundBounds.max.x - edgePad;
    const minZ = groundBounds.min.z + edgePad;
    const maxZ = groundBounds.max.z - edgePad;

    const rand = (a,b)=>Math.random()*(b-a)+a;

    let placed = 0, attempts = 0;
    while ( placed < count && attempts < count * 10 ) {
        attempts++;

        const cx = rand( minX, maxX );
        const cz = rand( minZ, maxZ );

        const dHole = Math.hypot( cx - holeInfo.center.x, cz - holeInfo.center.y );
        if ( dHole < holeInfo.radius + holeClear + depth ) continue;
        const dTee = Math.hypot( cx - 0, cz - 0 );
        if ( dTee < centerClear ) continue;

        const len = rand( minLen, maxLen );
        const half = len * 0.5;

        let yaw;
        if ( Math.random() < 0.5 ) {
            yaw = rand( 0, Math.PI );
        } else {
            const dirX = holeInfo.center.x - cx;
            const dirZ = holeInfo.center.y - cz;
            const base = Math.atan2( dirX, dirZ );
            yaw = base + Math.PI * 0.5;
        }

        const ex = Math.sin( yaw ) * half;
        const ez = Math.cos( yaw ) * half;

        let x1 = cx - ex, z1 = cz - ez;
        let x2 = cx + ex, z2 = cz + ez;

        x1 = Math.min( Math.max( x1, minX ), maxX );
        x2 = Math.min( Math.max( x2, minX ), maxX );
        z1 = Math.min( Math.max( z1, minZ ), maxZ );
        z2 = Math.min( Math.max( z2, minZ ), maxZ );

        if ( Math.hypot( x2 - x1, z2 - z1 ) < 0.75 ) continue;

        createWalls( x1, z1, x2, z2, height, depth );
        placed++;
    }
}
function createWalls( x1, z1, x2, z2, height = 1, depth = 0.3 ) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.max( 0.01, Math.hypot( dx, dz ) );

    const cx = ( x1 + x2 ) * 0.5;
    const cz = ( z1 + z2 ) * 0.5;

    const angY = Math.atan2( dx, dz );

    const pos = new THREE.Vector3( cx, holeInfo.topY + height * 0.5, cz );
    const quat = new THREE.Quaternion().setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), angY );

    const wallMat = new THREE.MeshPhongMaterial( { color: 0x8B4513 } );
    const wall = createParalellepiped(
        len, height, depth, 0, pos, quat, wallMat,
        colGroupStatic, colGroupBall | colGroup
    );
    const body = wall.userData.physicsBody;
    if ( body ) {
        body.setFriction( 1.0 );
        body.setRollingFriction( 1.0 );
    }

    obstacles.push( wall );
    return wall;
}

function clearWalls() {
    for ( let i = obstacles.length - 1; i >= 0; i -- ) {
        removeRigidBodyObject( obstacles[ i ] );
        obstacles.splice( i, 1 );
    }
}

function processGeometry( bufGeometry ) {

	const posOnlyBufGeometry = new THREE.BufferGeometry();
	posOnlyBufGeometry.setAttribute( 'position', bufGeometry.getAttribute( 'position' ) );
	posOnlyBufGeometry.setIndex( bufGeometry.getIndex() );

	const indexedBufferGeom = BufferGeometryUtils.mergeVertices( posOnlyBufGeometry );

	mapIndices( bufGeometry, indexedBufferGeom );

}

function isEqual( x1, y1, z1, x2, y2, z2 ) {

	const delta = 0.001;
	return Math.abs( x2 - x1 ) < delta &&
			Math.abs( y2 - y1 ) < delta &&
			Math.abs( z2 - z1 ) < delta;

}

function mapIndices( bufGeometry, indexedBufferGeom ) {

	const vertices = bufGeometry.attributes.position.array;
	const idxVertices = indexedBufferGeom.attributes.position.array;
	const indices = indexedBufferGeom.index.array;

	const numIdxVertices = idxVertices.length / 3;
	const numVertices = vertices.length / 3;

	bufGeometry.ammoVertices = idxVertices;
	bufGeometry.ammoIndices = indices;
	bufGeometry.ammoIndexAssociation = [];

	for ( let i = 0; i < numIdxVertices; i ++ ) {

		const association = [];
		bufGeometry.ammoIndexAssociation.push( association );

		const i3 = i * 3;

		for ( let j = 0; j < numVertices; j ++ ) {

			const j3 = j * 3;
			if ( isEqual( idxVertices[ i3 ], idxVertices[ i3 + 1 ], idxVertices[ i3 + 2 ],
				vertices[ j3 ], vertices[ j3 + 1 ], vertices[ j3 + 2 ] ) ) {

				association.push( j3 );

			}

		}

	}

}

function createSoftVolume( bufferGeom, mass, pressure ) {

	processGeometry( bufferGeom );

	const volume = new THREE.Mesh( bufferGeom, new THREE.MeshPhongMaterial( { color: 0xFFFFFF } ) );
	volume.castShadow = true;
	volume.receiveShadow = true;
	volume.frustumCulled = false;
	scene.add( volume );

	textureLoader.load( 'images/colors.png', function ( texture ) {

		volume.material.map = texture;
		volume.material.needsUpdate = true;

	} );

	// Volume physic object

	const volumeSoftBody = softBodyHelpers.CreateFromTriMesh(
		physicsWorld.getWorldInfo(),
		bufferGeom.ammoVertices,
		bufferGeom.ammoIndices,
		bufferGeom.ammoIndices.length / 3,
		true );

	const sbConfig = volumeSoftBody.get_m_cfg();
	sbConfig.set_viterations( 40 );
	sbConfig.set_piterations( 40 );

	// Soft-soft and soft-rigid collisions
	sbConfig.set_collisions( 0x11 );

	// Friction
	sbConfig.set_kDF( 0.1 );
	// Damping
	sbConfig.set_kDP( 0.01 );
	// Pressure
	sbConfig.set_kPR( pressure );
	// Stiffness
	volumeSoftBody.get_m_materials().at( 0 ).set_m_kLST( 0.9 );
	volumeSoftBody.get_m_materials().at( 0 ).set_m_kAST( 0.9 );

	volumeSoftBody.setTotalMass( mass, false );
	Ammo.castObject( volumeSoftBody, Ammo.btCollisionObject ).getCollisionShape().setMargin( margin );
	physicsWorld.addSoftBody( volumeSoftBody, 1, - 1 );
	volume.userData.physicsBody = volumeSoftBody;
	// Disable deactivation
	volumeSoftBody.setActivationState( 4 );

	softBodies.push( volume );

}


function createParalellepiped( sx, sy, sz, mass, pos, quat, material, group, mask ) {
	const threeObject = new THREE.Mesh( new THREE.BoxGeometry( sx, sy, sz, 1, 1, 1 ), material );
	const shape = new Ammo.btBoxShape( new Ammo.btVector3( sx * 0.5, sy * 0.5, sz * 0.5 ) );
	shape.setMargin( margin );

	createRigidBody( threeObject, shape, mass, pos, quat, group, mask );

	return threeObject;

}

function createRigidBody( threeObject, physicsShape, mass, pos, quat, group, mask ) {

	threeObject.position.copy( pos );
	threeObject.quaternion.copy( quat );

	const transform = new Ammo.btTransform();
	transform.setIdentity();
	transform.setOrigin( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
	transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
	const motionState = new Ammo.btDefaultMotionState( transform );

	const localInertia = new Ammo.btVector3( 0, 0, 0 );
	physicsShape.calculateLocalInertia( mass, localInertia );

	const rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, physicsShape, localInertia );
	const body = new Ammo.btRigidBody( rbInfo );

	threeObject.userData.physicsBody = body;

	scene.add( threeObject );

	if ( mass > 0 ) {

		rigidBodies.push( threeObject );

		body.setActivationState( 1 );
		body.setSleepingThresholds( 0.1, 0.1 );

	}

	if ( group !== undefined && mask !== undefined ) {
		physicsWorld.addRigidBody( body, group, mask );
	} else {
		physicsWorld.addRigidBody( body );
	}

	return body;

}

function initInput() {
    window.addEventListener( 'mousemove', function ( event ) {

        mouseCoords.set(
            ( event.clientX / window.innerWidth ) * 2 - 1,
            - ( event.clientY / window.innerHeight ) * 2 + 1
        );

    }, false );

}

function processClick() {

	if ( clickRequest ) {
		shootBall();
		clickRequest = false;
	}

}

function shootBall() {
	const ballMass = 4.593;
	const ballRadius = 0.4;

	const spawnPos = playerOrigin.clone();

	const ballGeom = new THREE.IcosahedronGeometry( ballRadius, 3 );
	const ballMat = new THREE.MeshStandardMaterial( {
		flatShading: true,
		color: 0xFFFFFF,
		emissive: 0x222222,
		emissiveIntensity: 0.15,
		polygonOffset: true,
		polygonOffsetUnits: 1,
		polygonOffsetFactor: 1,
	} );
	const ball = new THREE.Mesh( ballGeom, ballMat );
	ball.userData.isBall = true;
	ball.userData.radius = ballRadius;

	const ballShape = new Ammo.btSphereShape( ballRadius );
	ballShape.setMargin( margin );

	const quat = new THREE.Quaternion().set( 0, 0, 0, 1 );
    const ballBody = createRigidBody(
        ball,
        ballShape,
        ballMass,
        spawnPos,
        quat,
        colGroupBall,
        colGroupStatic | colGroup
    );
	ballBody.setFriction( 0.1 );
	ballBody.setDamping( 0.03, 0.6 );
	ballBody.setSleepingThresholds( 0.1, 0.1 );
	ballBody.setActivationState( 1 );
	ballBody.setCcdMotionThreshold( ballRadius * 0.5 );
	ballBody.setCcdSweptSphereRadius( ballRadius * 0.4 );

	const angY = THREE.MathUtils.degToRad( params.angle ); 
	const pitch = THREE.MathUtils.degToRad( params.elevation );
	const dir = new THREE.Vector3(
		Math.sin( angY ) * Math.cos( pitch ),
		Math.sin( pitch ),
		- Math.cos( angY ) * Math.cos( pitch )
	).normalize();

	const v = dir.multiplyScalar( params.power );
	ballBody.setLinearVelocity( new Ammo.btVector3( v.x, v.y, v.z ) );
}

function checkBallInHole() {
	if ( !groundMesh ) return;
	const cx = holeInfo.center.x;
	const cz = holeInfo.center.y;

	for ( let i = rigidBodies.length - 1; i >= 0; i -- ) {
		const obj = rigidBodies[ i ];
		if ( !obj.userData.isBall || obj.userData.inHole ) continue;

		const dx = obj.position.x - cx;
		const dz = obj.position.z - cz;
		const dist2 = dx * dx + dz * dz;

		const margin = Math.max( 0.02, obj.userData.radius * 0.5 );
		if ( dist2 <= Math.pow ( holeInfo.radius - margin, 2 ) &&
			obj.position.y < holeInfo.topY - margin ) {
				obj.userData.inHole = true;
				onBallInHole ( obj );
			}
	}
}

function onBallInHole( ball ) {
	score += 1;
	console.log(`Ball ${ball.id} is in the hole! YAY!! > ${score}`);
	const scoreDiv = document.getElementById('score')
	scoreDiv.textContent = `Score: ${score}`;
	setTimeout(() => {
		const body = ball.userData.physicsBody;
		if ( body && physicsWorld ) physicsWorld.removeRigidBody( body );
		scene.remove( ball );

		try {
			ball.geometry.dispose();
			ball.material.dispose();
		} catch (err) { console.log(err) };

		const idx  = rigidBodies.indexOf( ball );
		if ( idx !== -1 ) rigidBodies.splice( idx, 1 );
		if ( body ) {
			const ms = body.getMotionState && body.getMotionState();
			if ( ms ) Ammo.destroy( ms );
			Ammo.destroy( body );
		}
		resetGame();
	}, 300);
}

function resetGame() {
	clearWalls();
	for ( let i = rigidBodies.length - 1; i >= 0; i -- ) {
		const obj = rigidBodies[ i ];
		if ( obj && obj.userData && obj.userData.isBall ) {
			removeRigidBodyObject( obj );
		}
	}

	if ( rectMesh ) {
		try {
			if ( rectMesh.geometry ) rectMesh.geometry.dispose();
			if ( rectMesh.material ) rectMesh.material.dispose();
		} catch (err) { console.log( err ) };
		scene.remove( rectMesh );
		rectMesh = null;
	}

	if ( groundMesh ) {
		removeRigidBodyObject ( groundMesh );
		groundMesh = null;
		groundBounds = null;
	}

	createObjects();

	if ( controls && camera ) {
		controls.target.set( 0, holeInfo.topY, 0 );
		controls.update();
	}
}

function removeRigidBodyObject( obj ) {
    if ( !obj ) return;

    const body = obj.userData.physicsBody;

	if ( body && physicsWorld ) {
        physicsWorld.removeRigidBody( body );
    }

    scene.remove( obj );

	try {
		if ( obj.geometry ) obj.geometry.dispose();
		if ( obj.material ) {
			if ( Array.isArray( obj.material ) ) {
				obj.material.forEach( m => m.dispose && m.dispose() );
			} else if ( obj.material.dispose ) {
				obj.material.dispose();
			}
		}
	} catch (err) { console.log(err); }

    const idx = rigidBodies.indexOf( obj );
    if ( idx !== -1 ) rigidBodies.splice( idx, 1 );

    if ( body ) {
        const ms = body.getMotionState && body.getMotionState();
        if ( ms ) Ammo.destroy( ms );
        try { Ammo.destroy( body ); } catch ( err ) { console.log( err ) }
    }
}
function checkOutOfBounds() {
	const maxY = -10;
	for ( let i = rigidBodies.length - 1; i >= 0; i -- ) {
		const obj = rigidBodies[ i ];
		if ( !obj. userData.isBall ) continue;
		if ( obj.userData.removed ) continue;
		if ( obj.position.y < maxY ) {
			obj.userData.removed = true;
			removeRigidBodyObject( obj );
		}
	}
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	render();
	stats.update();

}

function render() {

	const deltaTime = clock.getDelta();

	updatePhysics( deltaTime );

	processClick();
    if ( rectMesh ) {
        const t = clock.getElapsedTime();
        const bob = rectMesh.userData.bob || { amplitude: 0.25, speed: 2.0 };
        rectMesh.position.y = rectMesh.userData.baseY + Math.sin( t * bob.speed ) * bob.amplitude;
    }
	renderer.render( scene, camera );

}

function updatePhysics( deltaTime ) {

    if ( !physicsWorld ) return;

    physicsWorld.stepSimulation( deltaTime, 10, 1 / 60 );

	for ( let i = 0, il = softBodies.length; i < il; i ++ ) {

		const volume = softBodies[ i ];
		const geometry = volume.geometry;
		const softBody = volume.userData.physicsBody;
		const volumePositions = geometry.attributes.position.array;
		const volumeNormals = geometry.attributes.normal.array;
		const association = geometry.ammoIndexAssociation;
		const numVerts = association.length;
		const nodes = softBody.get_m_nodes();
		for ( let j = 0; j < numVerts; j ++ ) {

			const node = nodes.at( j );
			const nodePos = node.get_m_x();
			const x = nodePos.x();
			const y = nodePos.y();
			const z = nodePos.z();
			const nodeNormal = node.get_m_n();
			const nx = nodeNormal.x();
			const ny = nodeNormal.y();
			const nz = nodeNormal.z();

			const assocVertex = association[ j ];

			for ( let k = 0, kl = assocVertex.length; k < kl; k ++ ) {

				let indexVertex = assocVertex[ k ];
				volumePositions[ indexVertex ] = x;
				volumeNormals[ indexVertex ] = nx;
				indexVertex ++;
				volumePositions[ indexVertex ] = y;
				volumeNormals[ indexVertex ] = ny;
				indexVertex ++;
				volumePositions[ indexVertex ] = z;
				volumeNormals[ indexVertex ] = nz;

			}

		}

		geometry.attributes.position.needsUpdate = true;
		geometry.attributes.normal.needsUpdate = true;

	}
    for ( let i = 0, il = rigidBodies.length; i < il; i ++ ) {
        const objThree = rigidBodies[ i ];
        const body = objThree.userData.physicsBody;
        if ( !body ) continue;

        const ms = body.getMotionState && body.getMotionState();
        if ( ms ) {
            ms.getWorldTransform( transformAux1 );
            const p = transformAux1.getOrigin();
            const q = transformAux1.getRotation();
            objThree.position.set( p.x(), p.y(), p.z() );
            objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );
        }
    }

    for ( let i = rigidBodies.length - 1; i >= 0; i-- ) {
        const obj = rigidBodies[ i ];
        if ( !obj.userData.isBall ) continue;

        const body = obj.userData.physicsBody;
        const lv = body.getLinearVelocity();
        const av = body.getAngularVelocity && body.getAngularVelocity();
        const speed2 = lv.x()*lv.x() + lv.y()*lv.y() + lv.z()*lv.z();
        const aspeed2 = av ? (av.x()*av.x() + av.y()*av.y() + av.z()*av.z()) : 0;

        if ( speed2 < 0.005 && aspeed2 < 0.005 ) {
            obj.userData.stillTime = (obj.userData.stillTime || 0) + deltaTime;
        } else {
            obj.userData.stillTime = 0;
        }

        if ( obj.userData.stillTime > 2.0 ) {
            removeRigidBodyObject( obj );
        }
    }

    checkOutOfBounds();
    checkBallInHole();

}