import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

let container, stats;
let camera, controls, scene, renderer;
let textureLoader;
const clock = new THREE.Clock();
let clickReq = false;
const mouseCord = new THREE.Vector2();

function main() {

	const canvas = document.querySelector( '#c' );
	const renderer = new THREE.WebGLRenderer( { antialias: true, canvas } );
	renderer.setPixelRatio( window.devicePixelRatio || 1 );
    renderer.setSize( window.innerWidth, window.innerHeight, false );
	const fov = 40;
	const aspect = 2; // the canvas default
	const near = 0.1;
	const far = 1000;

	const frustumSize = 100;
	const aspectRatio = window.innerWidth / window.innerHeight
	const camera = new THREE.OrthographicCamera(
		-frustumSize * aspectRatio / 2,
		frustumSize * aspectRatio / 2,
		frustumSize / 2,
		-frustumSize / 2,
		near,
		far
	)
	// const camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.08;
	controls.minDistance = 2;
	controls.maxDistance = 80;
	controls.update();
	camera.position.z = 120;

	function orthoView(view, distance = 120) {
		switch (view) {
			case 'front':
				camera.position.set(0, 0, distance);
				camera.up.set(0, 1, 0);
				break;
			case 'top':
				camera.position.set(0, distance, 0);
				camera.up.set(0, 0, -1);
				break;
			case 'left':
				camera.position.set(-distance, 0, 0);
				camera.up.set(0, 1, 0);
				break
			default:
				return;
		}
		controls.target.set(0, 0, 0);
		controls.update();
		camera.updateProjectionMatrix();
	}

	window.addEventListener('keydown', (e) => {
		if (e.key == 'w') orthoView('top');
		if (e.key == 'q') orthoView('front');
		if (e.key == 'd') orthoView('left');
	})
	const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xAAAAAA);
    const ambient = new THREE.AmbientLight(0x404040, 1.0);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);
    const objects = [];
    const spread = 1;
    function addObject(x, y, obj) {
        obj.position.x = x * spread;
        obj.position.y = y * spread;

        scene.add(obj);
        objects.push(obj)
    }

	let stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	document.body.appendChild( stats.domElement );
    function createMaterial(color) {
        const material = new THREE.MeshPhongMaterial({
            // side: THREE.DoubleSide,
        });
        const hue = Math.random();
        const saturation = 1;
        const luminance = 0.5;
        material.color.setHSL(hue, saturation, luminance);

        return material;
    }
    
    function addSolidGeometry(x, y, geometry, color) {
        const mesh = new THREE.Mesh(geometry, createMaterial());
        addObject(x, y, mesh)
    }
	const radius = 7;
	const widthSegments = 24;
	const heightSegments = 16;
	const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
	addSolidGeometry(0, 0, geometry);

	function resizeRendererToDisplaySize( renderer ) {

		const canvas = renderer.domElement;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const needResize = canvas.width !== width || canvas.height !== height;
		if ( needResize ) {

			renderer.setSize( width, height, false );

		}

		return needResize;

	}

	function render( time ) {

		time *= 0.001;

		if ( resizeRendererToDisplaySize( renderer ) ) {

			const canvas = renderer.domElement;
			const aspect = canvas.clientWidth / canvas.clientHeight;

			camera.left = -frustumSize * aspect / 2;
			camera.right = frustumSize * aspect / 2;
			camera.top =  frustumSize / 2;
			camera.bottom = -frustumSize / 2;	
			// camera.aspect = aspect;
			camera.updateProjectionMatrix();

		}

		objects.forEach( ( obj, ndx ) => {

			const speed = 1 + ndx * .1;
			const rot = time * speed;
			obj.rotation.x = rot;
			obj.rotation.y = rot;

		} );

		renderer.render( scene, camera );

		requestAnimationFrame( render );

	}

	requestAnimationFrame( render );

}

main();