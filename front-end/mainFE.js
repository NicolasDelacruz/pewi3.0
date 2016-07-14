//global vars
var camera, scene, raycaster, mouse, hoveredOver, bgCam;
var bgScene = null;
var renderer = new THREE.WebGLRenderer();
var controls;
var river = null;
var riverPoints = [];
var painter = 1;
var onYear = "year1";
var boardData = [];
var currentBoard = -1;
var currentYear = 1;
var modalUp = false;
var isShiftDown = false;
var Totals; //global current calculated results, NOTE, should be reassigned every time currentBoard is changed
var counter = 0;
var stats = new Stats();
var SCREEN_WIDTH, ASPECT, NEAR, FAR;
var skybox = false;

//createThreeFramework instantiates the renderer and scene to render 3D environment
function createThreeFramework(){
    
    //set up renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    //scene
    scene = new THREE.Scene();

} //end createThreeFramework()

//initializeCamera adds the camera object with specifications to the scene
function initializeCamera(){
    
    //camera
    SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
    ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 10000;
    camera = new THREE.PerspectiveCamera(75, ASPECT, NEAR, FAR);
    scene.add(camera);
    
    //point camera
    camera.position.y = 320;
    camera.position.z = 0;
    camera.rotation.x = -1.570795331865673;
    
    //set up controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);

    //add resize listener
    window.addEventListener('resize', onResize, false);
    
} //end initializeCamera

//initializeLighting adds the lighting with specifications to the scene
function initializeLighting(){
    
    //lighting
    var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    hemiLight.position.set(0, 30, 100);
    scene.add(hemiLight);

    //Deprecated if no shadows will be created
    var spotLight = new THREE.SpotLight(0xffffff, 0.1);
    spotLight.position.set(0, 0, 0);
    spotLight.position = camera.position;
    spotLight.castShadow = true;
    spotLight.angle = -70 * Math.PI / 180;
    spotLight.penumbra = 0.01;
    spotLight.decay = 0;
    spotLight.distance = 800;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.camera.near = 1;
    spotLight.shadow.camera.far = 500;
    
} //end initializeCamera

//renderBackground selects to render a skybox or a static background
function renderBackground(){
    if(skybox){
        setupSkyBox();
    } else {
        setupStaticBackground();        
    }
} //end renderBackground

function loadingManager(){
    
    THREE.DefaultLoadingManager.onProgress = function ( item, loaded, total ) {
    
       console.log("loaded " + loaded + " of " + total);
    
    };
   
   THREE.DefaultLoadingManager.onLoad = function (){
       console.log("loaded") ;
     
       document.getElementById('loading').style.display = "none" ;
       document.getElementById('page').style.visibility = "visible" ;
       
      //work around for firefox..... see bug 554039
      document.getElementById('firefoxWorkaround').focus() ;
      //
     
    };
    
}

//initSandbox initializes a sandbox game in the threeFramework
function initWorkspace(file){
    
    document.getElementById('startupSequence').style.display = "none" ;
    document.getElementById('loading').style.visibility = "visible" ;
   
    loadingManager();
    
    //setup stats display
    stats.domElement.id = 'statFrame' ;
    document.body.appendChild(stats.domElement);
    
    var hold = loadResources();
    
    hold = setupBoardFromFile(file) ;

    toggleVisibility() ;
    
    renderBackground();

    for(var y=0; y <=3; y++){
        
        var idName = "year" + y + "Precip" ;
         
        if(immutablePrecip){
                       document.getElementById(idName).style.display = "none" ;
                        
                        var precipValue = boardData[currentBoard].precipitation[y] ;
                        idName += "Container" ;
                        var string = document.getElementById(idName).innerHTML ;
                        string = string + "  " + precipValue ;
                        document.getElementById(idName).innerHTML = string ;
        }
        else {
            document.getElementById(idName).options[boardData[currentBoard].precipitationIndex[y]].selected = true;            
        }
      }
    
}

function animationFrames(){
    
    requestAnimationFrame(function animate() {

   renderer.autoClear = false;
   if(bgScene != null){
    renderer.render(bgScene, bgCam);
   }
   renderer.render(scene, camera);

    //wait # update frames to check
    if (counter > 20) {
        gameDirector();
        counter = 0;
    }
    counter += 1;

    requestAnimationFrame(animate);
    stats.update();

    
    
  }); //end request
    
}

//setupSkyBox instantiates the skybox background (HI-DEF Version)
function setupSkyBox() {

    for (var i = 0; i < 6; i++) materialArray[i].side = THREE.BackSide;
    var skyboxMaterial = new THREE.MeshFaceMaterial(materialArray);
    skyboxGeom = new THREE.CubeGeometry(5000, 5000, 5000, 1, 1, 1);
    var skybox = new THREE.Mesh(skyboxGeom, skyboxMaterial);
    scene.add(skybox);

} //end setupSkyBox

//setupStaticBackground uses the old pewi graphics as a background image
function setupStaticBackground() {
    
    var r = Math.floor(Math.random() * oldPewiBackgrounds.length);
    
    var bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2, 0),
    new THREE.MeshBasicMaterial({map: oldPewiBackgrounds[r]})
    );

    bg.material.depthTest = false;
    bg.material.depthWrite = false;
    
    bgScene = new THREE.Scene();
    bgCam = new THREE.Camera();
    bgScene.add(bgCam);
    bgScene.add(bg);
	
	var ambiLight = new THREE.AmbientLight(0x404040, 6.0);
    bgScene.add(ambiLight);
    
} //end setupStaticBackground

function switchBoards(newBoard){
    
    //remove points of previous board's river if present
    if (riverPoints.length > 0) {
        riverPoints = [];
    }
    
    //push into current board
    boardData.push(newBoard);
    currentBoard++;
    boardData[currentBoard].updateBoard();

    refreshBoard();
    setupRiver();
    previousHighlight = 0;

    //update Results to point to correct board since currentBoard is updated
    Totals = new Results(boardData[currentBoard]);
    
} //end switchBoards

//setupBoardFromFile creates a new gameboard from a stored file and creates a river for the board
function setupBoardFromFile(file) {
    
    //addBoard
    var boardFromFile = new GameBoard();
    loadBoard(boardFromFile, file);
    
    switchBoards(boardFromFile);

    return 1 ;
    
} //end setupBoardFromFile

function setupBoardFromUpload(data) {

    //addBoard
    var boardFromUpload = new GameBoard();
    parseInitial(data);
    propogateBoard(boardFromUpload);
    
    switchBoards(boardFromUpload);

} //end setupBoardFromUpload

//Create a river object with tributaries
function setupRiver() {
    
    if (river != null) {
        scene.remove(river);
    }
    
    river = new THREE.Object3D();
    
    for(var j = 0; j < riverPoints.length; j++){
        
        var riverCurve1 = []; 
        var riverCurve2 = [];
        for(var i = 0; i < riverPoints[j].length; i++){
            riverCurve1.push(new THREE.Vector3(Math.min(riverPoints[j][i].x + 5, riverPoints[j][i].x + 2 * ((3*i)+1)/3), tToggle ? (i == riverPoints[j].length-1 ? 1.5 : riverPoints[j][i].y+7) : riverPoints[j][i].y, riverPoints[j][i].z));
            riverCurve2.push(new THREE.Vector3(Math.max(riverPoints[j][i].x - 5, riverPoints[j][i].x - 2 * ((3*i)+1)/3), tToggle ? (i == riverPoints[j].length-1 ? 1.5 : riverPoints[j][i].y+7) : riverPoints[j][i].y, riverPoints[j][i].z));
        }
        
        var curve1 = new THREE.CatmullRomCurve3(riverCurve1);
            curve1.type = 'chordal';
            curve1.closed = false;
            var curve1geo = new THREE.Geometry();
            curve1geo.vertices = curve1.getPoints(500);
    
        var curve2 = new THREE.CatmullRomCurve3(riverCurve2);
            curve2.type = 'chordal';
            curve2.closed = false;
            var curve2geo = new THREE.Geometry();
            curve2geo.vertices = curve2.getPoints(500);
       
        var riverCurve = new THREE.Geometry();
        var riverMeshVertices = curve1geo.vertices;
        riverMeshVertices = riverMeshVertices.concat(curve2geo.vertices);
        
        
        var holes = [];
        riverCurve.vertices = riverMeshVertices;
        
        for(var i = 0; i < riverCurve.vertices.length - curve1geo.vertices.length - 1; i++){
            riverCurve.faces.push(new THREE.Face3(i, i + 1, i + curve1geo.vertices.length));
            riverCurve.faces.push(new THREE.Face3(i + curve1geo.vertices.length, i + curve1geo.vertices.length + 1, i + 1));
        }
    
        var material = new THREE.MeshBasicMaterial({
            wireframe: false,
            side: THREE.DoubleSide,
            color: 0x40a4df,
            opacity: 1,
            transparent: true
        });
    
        riverStream = new THREE.Mesh(riverCurve, material);
        river.add(riverStream);
        
    }
    
    scene.add(river);
}

function setupHighlight() {

    //set up mouse functions and raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2(), hoveredOver;

    //add mouse listener
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('click', onDocumentMouseDown, false);
    document.addEventListener('keydown', onDocumentKeyDown, false);
    document.addEventListener('keyup', onDocumentKeyUp, false);

}; //end setupHighlight

function showMainMenu() {
    if(confirm('Are you sure you want to exit? All your progress will be lost.')){

       document.getElementById('loading').style.display = "block" ; 
       document.getElementById('startUpFrame').contentWindow.recallMain() ;
        
        setTimeout(function() {
            
        document.getElementById('startupSequence').style.display = "block" ;
        //clearPopup();
        //
            
        previousHover = null ;
        paintChange(1) ;
        switchConsoleTab(1);
        switchYearTab(1);
        controls.reset() ;
        
         if(levelGlobal > 0){
            //clean up from a level

            console.log("---cleaning up---");
            resetLevel();
            clearPopup() ;
            
            window.top.document.getElementById('parameters').innerHTML = "" ;
            toggleVisibility() ;

        }
        //achievementValues = [];
        document.getElementById('page').style.visibility = "hidden" ;}, 1000 );
        
        
        
    }
}