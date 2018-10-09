var scene = null,
camera = null,
root = null,
robot_idle = null,
robot_attack = null,
flamingo = null,
stork = null,
group = null,
orbitControls = null;

var robot_mixer = {};
var deadAnimator;
var morphs = [];

var duration = 1000; // ms
var currentTime = Date.now();

var animation = "idle";

var animator = null;


var robots = [];

var mouse = new THREE.Vector2(), INTERSECTED, CLICKED;

var renderer = null;
var raycaster = null;
var score = null;
var time = 0;
var game_started = false;



class Robot {
  constructor(object) {
    this.object = object;
    this.mixer = {};
    this.currentState = "idle";

    this.mixer["idle"] = new THREE.AnimationMixer( scene );
    this.mixer["attack"] = new THREE.AnimationMixer( scene );
    this.mixer["run"] = new THREE.AnimationMixer( scene );
    this.mixer["walk"] = new THREE.AnimationMixer( scene );

    this.mixer["idle"].clipAction( this.object.animations[0], this.object ).play();
    this.mixer["attack"].clipAction( this.object.animations[1], this.object ).play();
    this.mixer["run"].clipAction( this.object.animations[2], this.object ).play();
    this.mixer["walk"].clipAction( this.object.animations[3], this.object ).play();

    this.object.position.z = -110;

  }
  clone(){
    return new Robot(cloneFbx(this.object));
  }
  setState(state){
    this.currentState = state;
  }
  resetPosition(){
    this.object.position.z = -90 - Math.random() * 50;
  }
  kill(){
    // Attack and stop attacking for more realistic dead
    this.setState("attack");
    startDeadAnimation(this.object);
    var that = this;
    setTimeout(function(){
      that.mixer["attack"].clipAction( that.object.animations[1], that.object ).stop();
      setTimeout(function(){
        if(game_started == true){
          that.object.rotation.set(0,0,0);
          that.setState("run");
          that.resetPosition();
          that.mixer["attack"].clipAction( that.object.animations[1], that.object ).play();
        }
      }, 4000);

    }, 500);
  }
}


function modifyScore(mod){
  score += mod;
  $("#score").html(score);
}


function startDeadAnimation(object) {
  animator = new KF.KeyFrameAnimator;
  animator.init({
      interps:
          [
              {
                  keys:[0, 1],
                  values:[
                          { x : 0, y:0, z: 0 },
                          { x : -1, y:0, z: 1 }
                          ],
                  target: object.rotation
              }
          ],
      loop: false,
      duration:duration*.8,
  });
  animator.start();
}


function loadRobot(callback){
    var loader = new THREE.FBXLoader();
    loader.load( '../models/Robot/robot_idle.fbx', function ( object )
    {
        object.scale.set(0.02, 0.02, 0.02);
        object.position.y -= 4;
        object.traverse( function ( child ) {
            if ( child.isMesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        } );
        robot_idle = object;
        loader.load( '../models/Robot/robot_atk.fbx', function ( object ){
            robot_idle.animations.push(object.animations[ 0 ]);
            loader.load( '../models/Robot/robot_run.fbx', function ( object ){
                robot_idle.animations.push(object.animations[ 0 ]);
                loader.load( '../models/Robot/robot_walk.fbx', function ( object ){
                    robot_idle.animations.push(object.animations[ 0 ]);
                    callback(new Robot(robot_idle));
                } );
            } );
        } );
    } );
}

function stopGame() {
  $(".menu").show();
  $("#final_score").html("Your final score is: " + score);
  $("#final_score").show()
  $("#score").html(0);
  $("#timer").html(0);
  for (var i = 0; i < robots.length; i++) {
    robots[i].setState("idle");
  }
}


function animate() {

    var now = Date.now();
    var deltat = now - currentTime;
    currentTime = now;

    if(robot_idle && robot_mixer[animation])
    {
        robot_mixer[animation].update(deltat * 0.001, 2);
    }

    if(game_started == true){
      time -= deltat*0.001;

      if(time <= 0){
        stopGame();
        game_started=false;
      }
    }




    $("#timer").html(time.toFixed(1));

    if(robots.length != 0){
      for (var i = 0; i < robots.length; i++) {
        robots[i].mixer[robots[i].currentState].update(deltat * 0.002);
        if(robots[i].currentState == "run"){
          robots[i].object.position.z += 0.03 * deltat;
          if(robots[i].object.position.z > 40){
            modifyScore(-10);
            robots[i].resetPosition();
          }
        }
      }
    }

    KF.update();

}

function onDocumentMouseDown(event)
{
    event.preventDefault();
    event.preventDefault();
    killIntersects();
}

function killIntersects() {
  mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

  // find intersections
  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObjects( scene.children, true );

  if ( intersects.length > 0 )
  {
    id = intersects[0].object.parent.userData['id'];
    if(robots[id].currentState != "attack" && game_started){
      robots[id].kill();
      modifyScore(20);
    }

  }
}



function onDocumentMouseMove(event)
{
    event.preventDefault();
    killIntersects();

}




function onWindowResize()
{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}


function run() {
    requestAnimationFrame(function() { run(); });

        // Render the scene
        renderer.render( scene, camera );

        // Spin the cube for next frame
        animate();

        // Update the camera controller
        orbitControls.update();

}


function setLightColor(light, r, g, b)
{
    r /= 255;
    g /= 255;
    b /= 255;

    light.color.setRGB(r, g, b);
}

var directionalLight = null;
var spotLight = null;
var ambientLight = null;
var mapUrl = "../images/checker_large.gif";

var SHADOW_MAP_WIDTH = 2048, SHADOW_MAP_HEIGHT = 2048;

function createScene(canvas) {
    raycaster = new THREE.Raycaster();
    // Create the Three.js renderer and attach it to our canvas
    renderer = new THREE.WebGLRenderer( { canvas: canvas, antialias: true } );

    // Set the viewport size
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Turn on shadows
    renderer.shadowMap.enabled = true;
    // Options are THREE.BasicShadowMap, THREE.PCFShadowMap, PCFSoftShadowMap
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Create a new Three.js scene
    scene = new THREE.Scene();

    // Add  a camera so we can view the scene
    // camera = new THREE.PerspectiveCamera( 45, canvas.width / canvas.height, 1, 4000 );
    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 10000 );

    camera.position.set(-15, 6, 30);
    scene.add(camera);

    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);

    // Create a group to hold all the objects
    root = new THREE.Object3D;

    spotLight = new THREE.SpotLight (0xffffff);
    spotLight.position.set(-120, 8, -10);
    spotLight.target.position.set(-2, 0, -2);
    root.add(spotLight);

    spotLight.castShadow = true;

    spotLight.shadow.camera.near = 1;
    spotLight.shadow.camera.far = 200;
    spotLight.shadow.camera.fov = 45;

    spotLight.shadow.mapSize.width = SHADOW_MAP_WIDTH;
    spotLight.shadow.mapSize.height = SHADOW_MAP_HEIGHT;

    ambientLight = new THREE.AmbientLight ( 0x888888 );
    root.add(ambientLight);



    // Create a group to hold the objects
    group = new THREE.Object3D;
    root.add(group);

    // Create a texture map
    var map = new THREE.TextureLoader().load(mapUrl);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(8, 8);

    var color = 0xffffff;

    // Put in a ground plane to show off the lighting
    geometry = new THREE.PlaneGeometry(200, 180, 50, 50);
    var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color:color, map:map, side:THREE.DoubleSide}));


    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -4.02;

    mesh.position.z = -40;


    // Add the mesh to our group
    group.add( mesh );
    mesh.castShadow = false;
    mesh.receiveShadow = true;

    // Now add the group to our scene
    scene.add( root );


    document.addEventListener('mousedown', onDocumentMouseDown, false);
    // document.addEventListener( 'mousemove', onDocumentMouseMove, false );

    window.addEventListener( 'resize', onWindowResize, false );



}

function startGame(level) {
  for (var i = 0; i < robots.length; i++) {
    scene.remove( robots[i].object );
  }
  robots = [];
  score = 0;
  time = 60;

  $(".menu").hide();


  switch (level) {
    case 0:
      n_robots = 5
      break;
    case 1:
      n_robots = 10
      break;
    case 2:
      n_robots = 15
      break;
    case 3:
      n_robots = 25
      break;
    default:

  }

  loadRobot(function(robot){
    robot.object.userData = {'id':0};
    robots.push(robot);


    for (var i = 0; i < n_robots; i++) {
      var temp = robot.clone();
      temp.object.userData = {'id':i+1};
      robots.push(temp);
      temp.object.position.x += (Math.floor(Math.random() * 90) -0) * (Math.round(Math.random()) * 2 - 1)

    }

    game_started = true;
    var current_i = 0;
    for (var i = 0; i < robots.length; i++)  {
      setTimeout(function(){
        scene.add(robots[current_i].object);
        robots[current_i].setState("run");
        current_i++;
      }, i*500);
    }


  });

}
