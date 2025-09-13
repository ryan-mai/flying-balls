import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Graphics variables
let container, stats, gui;
let camera, controls, scene, renderer;
let textureLoader;
const clock = new THREE.Clock();
let clickRequest = false;
const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const ballMaterial = new THREE.MeshPhongMaterial( { color: 0x202020 } );
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();

let groundMesh = null;
const holeInfo = { center: new THREE.Vector2(), radius: 0, topY: 0 };

const ballRadius = 0.4;
const ballMass = 4.593;
const playerOrigin = new THREE.Vector3( 0, 0, 0 );
const obstacles = [];
const params = { 
	power: 10,
	angleDeg: 0,
	elevationDeg: 5
}

// Physics variables
const gravityConstant = - 9.8;
let physicsWorld;
const rigidBodies = [];
const softBodies = [];
const margin = 0.05;
let transformAux1;
let softBodyHelpers;

if ( typeof Ammo === 'function' ) {

    Ammo().then( function ( AmmoLib ) {

        Ammo = AmmoLib;
        init();

    } );

} else if ( typeof Ammo === 'object' && Ammo !== null ) {

    // Ammo already loaded synchronously (e.g. via <script>)
    init();

} else {

    // Poll for Ammo if it's injected asynchronously
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
    const canvasEl = document.querySelector( '#c' );
    container = canvasEl || document.body;

    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.2, 2000 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xbfd1e5 );

    camera.position.set( - 7, 5, 8 );

    if ( canvasEl ) {
        renderer = new THREE.WebGLRenderer( { antialias: true, canvas: canvasEl } );
    } else {
        renderer = new THREE.WebGLRenderer( { antialias: true } );
        document.body.appendChild( renderer.domElement );
    }

    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;

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

	(canvasEl ? document.body : container).appendChild( stats.domElement );

    window.addEventListener( 'resize', onWindowResize );

}

function initPhysics() {

	// Physics configuration

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

	const boxGeometry = new THREE.BoxGeometry( 1, 1, 5, 4, 4, 20 );
	boxGeometry.translate( - 2, 5, 0 );
	createSoftVolume( boxGeometry, 0, 120 );
	
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

	playerOrigin.set( 0, holeInfo.topY + ballRadius + 0.02, 0 );

	{
		const marker = new THREE.Mesh(
            new THREE.CylinderGeometry( 0.15, 0.15, 0.02, 20 ),
            new THREE.MeshBasicMaterial( { color: 0xffcc00 } )
		);
		marker.position.set( playerOrigin.x, holeInfo.topY + 0.01, playerOrigin.z );
		scene.add( marker );
	}

    const rectHeight = 2.5;
    const rectGeometry = new THREE.BoxGeometry( 0.2, rectHeight, 0.2, 1, 1, 1 );
    const rectMat = new THREE.MeshPhongMaterial( { color: 0xDAA06D } );
    const rectMesh = new THREE.Mesh( rectGeometry, rectMat );
    // rectMesh.castShadow = true;
    rectMesh.receiveShadow = true;
    rectMesh.position.set( holeCenterX, holeInfo.topY + rectHeight * 0.75, holeCenterY );
    scene.add( rectMesh );

	textureLoader.load( 'textures/grid.png', function ( texture ) {
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

	const groundBody = createRigidBody( ground, triMeshShape, 0, ground.position, ground.quaternion );
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
    playerFolder.add( params, 'angleDeg', -360, 360, 1 );
    playerFolder.add( params, 'elevationDeg', -180, 180, 1 );

    const courseFolder = gui.addFolder( 'Course' );
    courseFolder.add( { add: () => addWallAcrossHole( 0.5, 6, 1, 0.3 ) }, 'add' ).name( 'Add wall across hole' );
    courseFolder.add( { clear: clearWalls }, 'clear' ).name( 'Clear obstacles' )
}

function createWalls( x1, z1, x2, z2, height = 1, depth = 0.3 ) {
	const dx = x2 - x1;
	const dz = z2 - z1;
	const len = Math.max( 0.01, Math.hypot( dx, dz ) );

	const cx = ( x1 + x2 ) * 0.5;
	const cz = ( z1 + z2 ) * 0.5;

	const angY = Math.atan2( dx, dz)

	const pos = new THREE.Vector3( cx, holeInfo.topY + height * 0.5, cz );
	const quat = new THREE.Quaternion().setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), angY );

	const wallMat = new THREE.MeshPhongMaterial( { color: 0x8B4513 } );
	const wall = createParalellepiped( len, height, depth, 0, pos, quat, wallMat );
	if ( body ) {
		body.setFriction( 1.0 );
		body.setRollingFriction( 1.0 );
	}
	obstacles.push( wall );
	return wall;
}

function addWalls( t = 0.5, amount = 6, height = 1, depth = 0.3) {
	const cx = 0, cz = 0;
	const hx = holeInfo.center.x, hz = holeInfo.center.y;

	const mx = THREE.MathUtils.lerp( cx, hx, t );
	const mz = THREE.MathUtils.lerp( cz, hz, t );

	const dir = new THREE.Vector2( hx - cx, hz - cz ).normalize();
	const perp = new THREE.Vector2( -dir.y, dir.x );

	const half = amount / 2;
	const p1 = new THREE.Vector2( mx, mz ).addScaledVector( perp, -half );
	const p2 = new THREE.Vector2( mx, mz ).addScaledVector( perp, half );

	return addWalls( p1.x, p1.y, p2.x, p2.y, height, depth)
}

function clearWalls() {
	for ( let i = obstacles.length - 1; i >= 0; i -- ) {
		removeRigidBodyObject( objects[ i ]);
		obstacles.splice( i, 1 );
	}
}

function processGeometry( bufGeometry ) {

	// Ony consider the position values when merging the vertices
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

	// Creates ammoVertices, ammoIndices and ammoIndexAssociation in bufGeometry

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

	textureLoader.load( 'textures/colors.png', function ( texture ) {

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


function createParalellepiped( sx, sy, sz, mass, pos, quat, material ) {

	const threeObject = new THREE.Mesh( new THREE.BoxGeometry( sx, sy, sz, 1, 1, 1 ), material );
	const shape = new Ammo.btBoxShape( new Ammo.btVector3( sx * 0.5, sy * 0.5, sz * 0.5 ) );
	shape.setMargin( margin );

	createRigidBody( threeObject, shape, mass, pos, quat );

	return threeObject;

}

function createRigidBody( threeObject, physicsShape, mass, pos, quat ) {

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

	physicsWorld.addRigidBody( body );

	return body;

}

function initInput() {

	window.addEventListener( 'click', function ( event ) {

		if ( ! clickRequest ) {

			mouseCoords.set(
				( event.clientX / window.innerWidth ) * 2 - 1,
				- ( event.clientY / window.innerHeight ) * 2 + 1
			);

			clickRequest = true;

		}

	} );

}

function processClick() {

	if ( clickRequest ) {
        const ballMass = 4.593;
        const ballRadius = 0.4;

        const spawnPos = playerOrigin.clone();

        const ballGeom = new THREE.IcosahedronGeometry( ballRadius, 3 );
        const ballMat = new THREE.MeshStandardMaterial( {
            flatShading: true,
            color: 0xFFFFFF,
            emissive: 0x222222,
            emissiveIntensity: 0.35,
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
        const ballBody = createRigidBody( ball, ballShape, ballMass, spawnPos, quat );
        ballBody.setFriction( 0.1 );
        ballBody.setDamping( 0.03, 0.6 );
        ballBody.setSleepingThresholds( 0.1, 0.1 );
        ballBody.setActivationState( 1 );
        ballBody.setCcdMotionThreshold( ballRadius * 0.5 );
        ballBody.setCcdSweptSphereRadius( ballRadius * 0.4 );

        const angY = THREE.MathUtils.degToRad( params.angleDeg ); 
        const pitch = THREE.MathUtils.degToRad( params.elevationDeg );
        const dir = new THREE.Vector3(
            Math.sin( angY ) * Math.cos( pitch ),
            Math.sin( pitch ),
            - Math.cos( angY ) * Math.cos( pitch )
        ).normalize();

        const v = dir.multiplyScalar( params.power );
        ballBody.setLinearVelocity( new Ammo.btVector3( v.x, v.y, v.z ) );

        clickRequest = false;

	}

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
	console.log(`Ball ${ball.id} is in the hole! YAY!! ${ball}`);

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
	}, 300);
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
        try { Ammo.destroy( body ); } catch ( e ) { /* ignore */ }
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
		const objPhys = objThree.userData.physicsBody;
		const ms = objPhys.getMotionState();
		if ( ms ) {

			ms.getWorldTransform( transformAux1 );
			const p = transformAux1.getOrigin();
			const q = transformAux1.getRotation();
			objThree.position.set( p.x(), p.y(), p.z() );
			objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );

		}

	}
	
	checkOutOfBounds();
	checkBallInHole();

}