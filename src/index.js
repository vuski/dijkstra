import {Deck}  from '@deck.gl/core';
import {ScatterplotLayer, PathLayer,PolygonLayer,TextLayer, BitmapLayer, SolidPolygonLayer, GeoJsonLayer} from '@deck.gl/layers';
import {DataFilterExtension} from '@deck.gl/extensions';
import {CSVLoader} from '@loaders.gl/csv';
import {JSONLoader} from '@loaders.gl/json'
import {TileLayer} from '@deck.gl/geo-layers';
import {load} from '@loaders.gl/core';
import {MapboxOverlay} from '@deck.gl/mapbox';
//const {JSONLoader, load} = json; 

import mapboxgl from 'mapbox-gl';
import MapboxLanguage from '@mapbox/mapbox-gl-language';
import FastPriorityQueue from 'fastpriorityqueue';
import {MinQueue} from "heapify";
import Delaunator from 'delaunator';


///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////  webgl class   정의       /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////


class DrawObject  {

  constructor () {
    this.vertexBO;
    this.indexBO;
    this.shader;
    this.indexCount;

    this.projectionMatrixLoc;
    this.viewMatrixLoc;
    this.lonLatUnitLoc;
    this.textureCoordLoc;
    this.info0;
    this.info1;

    this.vertexAttrib;

    this.textureLoc0;
    this.textureLoc1;

    this.numObj;
    this.numIndex;

    this.posAttrLoc;
    this.distAttrLoc;
    // this.framebuffer;
    // this.framebufferTexture;
  }

  createBuffer() {
    this.vertexBO = gl.createBuffer();
  }

  
  setVertexBufer() {
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBO);
    gl.bufferData(gl.ARRAY_BUFFER, 4 * 3 * this.numObj, gl.DYNAMIC_DRAW);
    this.posAttrLoc = gl.getAttribLocation(this.shader, "pos"); 
    this.distAttrLoc = gl.getAttribLocation(this.shader, "distance"); 
    gl.enableVertexAttribArray(this.posAttrLoc);   
    gl.enableVertexAttribArray(this.distAttrLoc);   

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

  }

  setIndexBufer(indexArray) {

    this.indexBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,  this.indexBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    this.indexCount = indexArray.length;
  }

  setShader(vert, frag) {

    // Create a vertex shader object
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vert);
    gl.compileShader(vertShader);
        
    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
        console.error(this, "vert:", gl.getShaderInfoLog(vertShader));
    }
    // Create fragment shader object
    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, frag); 
    gl.compileShader(fragShader);

    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
      console.error(this, "frag:",gl.getShaderInfoLog(fragShader));
    }

    this.shader = gl.createProgram();
    gl.attachShader(this.shader, vertShader);
    gl.attachShader(this.shader, fragShader);
    gl.linkProgram(this.shader);

  }

  /// set Uniforms
  setProjectionViewMatrix( projStr, viewStr) {
    this.projectionMatrixLoc = gl.getUniformLocation(this.shader, projStr);  
    this.viewMatrixLoc = gl.getUniformLocation(this.shader, viewStr);  
  }

  setUniformLonLat(lonLatUnitStr) {
    this.lonLatUnitLoc =  gl.getUniformLocation(this.shader, lonLatUnitStr);  
  }


  setUniformVar0(infoStr) {
    this.info0 =  gl.getUniformLocation(this.shader, infoStr);  
  }

  setUniformVar1(infoStr) {
    this.info1 =  gl.getUniformLocation(this.shader, infoStr);  
  }

  setVertexAttrib(attribStr) {
    this.vertexAttrib = gl.getAttribLocation(this.shader, attribStr);     
    gl.enableVertexAttribArray(this.vertexAttrib);
  }

  useShader() {
    gl.useProgram(this.shader);  
  }

  bindElementBuffer() {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBO);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBO);
  }

  bindUniform(__projectionMatrix, __viewMatrix) {

    gl.uniformMatrix4fv(this.projectionMatrixLoc, false, __projectionMatrix);
    gl.uniformMatrix4fv(this.viewMatrixLoc, false, __viewMatrix);
  }

  bindUniformLonLatUnit(lon, lat, unit, time) {
    gl.uniform4f(this.lonLatUnitLoc, lon, lat, unit, time);
  }

  bindUniformVar0(zoomLevel) {
    gl.uniform4f(this.info0, zoomLevel, 0.0, 0.0, 0.0);
  }

  bindUniformVar1(currentZoom) {
    gl.uniform4i(this.info1, currentZoom, 0, 0, 0);
  }

  drawElement() {
    gl.vertexAttribPointer(this.vertexAttrib, 3, gl.FLOAT, false, 0, 0); 
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT,0);
  }


  drawArrayQuad(primitive, count) {
    gl.drawArrays(primitive, 0, count);
  }



}


///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
let gl;

const canvas = document.getElementById('webglCanvas');


const isochrone = new DrawObject();


///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////  global Variables         /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////


TextLayer.fontAtlasCacheLimit = 10;

mapboxgl.accessToken = 'pk.eyJ1Ijoic2JraW00MjciLCJhIjoiY2o4b3Q0aXd1MDdyMjMzbnRxYTdvdDZrbCJ9.GCHi6-mDGEkd3F-knzSfRQ';

let currentZoom = 6;
const map = createMap('container');
initMap(map);

const w0= window.innerWidth;
const h0= window.innerHeight;

const svg =d3.select("#container")
    .append("svg")
    .attr("id", "popupText")
    .attr("width", w0)
    .attr("height", h0)
    .style("pointer-events", "none");

const textFeature = svg.append("g");
const w = window.innerWidth;
let canvas1 = document.getElementById('textCanvas');

let solution = new Array();
let predecessor = new Array();

  //priority_queue<NodeQ, vector<NodeQ>, cmpQ> currentQueue;


const currentQueue1 = new MinQueue(3000,[],[], Uint32Array, Float32Array);



// Quadtree 생성
let quadtree = d3.quadtree()
  .x(d => d.x)  // x 좌표로 접근
  .y(d => d.y)  // y 좌표로 접근

let nearestPointMouse = 0;

function createMap(containerID) {
  return  new mapboxgl.Map({
      container: containerID, // container ID
      //style: 'mapbox://styles/mapbox/streets-v11', // style URL
      style:  'mapbox://styles/sbkim427/cl6ool43r003o14kwmd8ogdwc',
      center: [ 127.6, 35.7], // starting position [lng, lat]
      zoom: 6, // starting zoom 
      //projection: 'globe' // display the map as a 3D globe
  });    
}

function initMap(map) { 
  //map.dragRotate.disable(); 
  //map.touchZoomRotate.disableRotation();    
  map.addControl(new MapboxLanguage({
      defaultLanguage: 'ko'    
    },
  ));
// map.on('style.load', () => {
//     map.setFog({}); // Set the default atmosphere style
// });
}

const deckOverlay =  new MapboxOverlay({
  //interleaved: false,
  layers: []
}); 


map.on('zoom', () => {
  
  update();

});
map.on('move', () => {
  
});

//document.getElementById("container").onclick = update;
map.addControl(deckOverlay);

window.addEventListener("keydown", (e) => {
  console.log(e);
  if (e.key=='1') {
   
  }
  if (e.key=='2') {
   
  }
  if (e.key=='3') {
    
  }
  update();
});


window.addEventListener("mousemove", (e) => {
  //console.log(e);
  const mousex = e.clientX;
  const mousey = e.clientY;
  const lngLat = map.unproject([mousex, mousey]);

  let nearestPoint = quadtree.find(lngLat.lng, lngLat.lat);
  nearestPointMouse = nearestPoint.id;


  const startTime = performance.now();

  resetNetwork();
  //console.log(solution);
  solveServiceAreaFromNode(nearestPointMouse, 300, graph);
  const endTime = performance.now();
  const executionTime = endTime - startTime;     
  console.log(`실행 시간: ${executionTime}ms`);
  //console.log(solution);


  //console.log(nearestPoint);  

  //console.log(lngLat);  // 변환된 경위도 좌표 출력


  update();
});

window.addEventListener('resize', function() {
  const w = window.innerWidth, h = window.innerHeight;

  canvas1.width = w;
  canvas1.height = w<800? 140 : 90;
  // d3.select("#textCanvas")
  //     .attr("width", w)
  //     .attr("height", 90);  
  d3.select("#popupText")
      .attr("width", w)
      .attr("height", h);  
  update();
});


function update() {

  const layers =  [

    new ScatterplotLayer({
      id: 'trafficNode',
      data: nodeMap,
      
      // Styles
      filled: true,

      radiusMinPixels: 2,
      //sizeMaxPixels: 10,
      radiusScale: 1,
      getPosition: d => [d.x, d.y],
      getRadius: d => {
        if (d.id ==nearestPointMouse) return 8;
        else return 3;
      },        
      // onHover: (info) => {
      //   showInfoBox(info);
      // },
      // onClick: (info) => {
      //   showInfoBox(info);
        
      // },
      pickable: true,
      autoHighlight: true,
      radiusUnits: 'pixels',
      getFillColor: d => {
        return [255, 20, 10];
      },
      updateTriggers: {
        // This tells deck.gl to recalculate radius when `currentYear` changes
        getRadius : [nearestPointMouse]       
      },
      // Interactive props      
      visible : true,
      //extensions: [new DataFilterExtension({filterSize: 1})],
      //getFilterValue: d => [d.persons],
      //filterRange: [[countFrom, countTo]],
    }),




  ];


  deckOverlay.setProps({
    layers : layers
  });  
 

}


let graph = {numNode : 0, numEdge : 0, rowOffset : 0, colIndex: 0, value : 0};

let nodeMap;


(async function loadData() {
  const nodeRaw = await load("./data/node.tsv", CSVLoader, {
    csv : {
      delimiter : ',',
      header : true,
    }
  });

  const linkRaw = await load("./data/link.tsv", CSVLoader, {
    csv : {
      delimiter : ',',
      header : true,
    }
  });
  
  nodeMap = new Array(nodeRaw.length);
  for (const d of nodeRaw) {
    const pos = proj4('EPSG:5179','EPSG:4326',[d.x,d.y]);
    nodeMap[d.id] =  {id: d.id, x : pos[0], y:pos[1], canBeStartNode : d.canBeStartNode};
  }

  const linkData = new Array();
  for (const d of linkRaw) {
    linkData.push({fromNode:d.fromNode, toNode:d.toNode, time : d.timeFT});
    linkData.push({fromNode:d.toNode, toNode:d.fromNode, time : d.timeTF});
  }

  linkData.sort((a, b) => {
    if (a.fromNode === b.fromNode) {
      // fromNode가 같을 경우 toNode를 기준으로 정렬
      return a.toNode - b.toNode;
    } else {
      // 그 외의 경우 fromNode를 기준으로 정렬
      return a.fromNode - b.fromNode;
    }
  });

  return {nodeMap, linkData};
})().then( ({nodeMap, linkData}) => {

  quadtree.addAll(nodeMap);
  //let nearestPoint = quadtree.find(127.045353, 37.514091);
  //console.log(nearestPoint);  

  //console.log(nodeMap, linkData);
  setCSRGraph(nodeMap, linkData);

  initWebGL();
  initIsochrone();




  update();

  console.log(graph);

  const startNodes = [178016, 104452, 342160];

  for (let startNode of  startNodes) {
    const startTime = performance.now();

    resetNetwork();
    //console.log(solution);
    solveServiceAreaFromNode(startNode, 300, graph);
    const endTime = performance.now();
    const executionTime = endTime - startTime;     
    console.log(`실행 시간: ${executionTime}ms`);
    console.log(solution);
  }
}); 




function setCSRGraph(nodeMap, linkData) {

  console.log(nodeMap.length);
  graph.numNode = nodeMap.length;
  graph.numEdge = linkData.length * 2;
  graph.rowOffset = new Array(graph.numNode+1);
  graph.colIndex = new Array(graph.numEdge);
  graph.value = new Array(graph.numEdge);

  let rowIndex = 0;   

  for (let i=0; i<linkData.length ; i++) {                
      
      while (rowIndex <= linkData[i].fromNode) {
          graph.rowOffset[rowIndex] = i;
          rowIndex++;
      }
      graph.colIndex[i] = linkData[i].toNode;
      graph.value[i] = linkData[i].time;
  }
  graph.rowOffset[rowIndex] = linkData.length;

}

function resetNetwork() {

  solution = new Array(graph.numNode).fill(Number.MAX_SAFE_INTEGER);;
  predecessor = new Array(graph.numNode).fill(Number.MAX_SAFE_INTEGER);
  
  
}

//이제 프라이어리티 큐

function solveServiceAreaFromNode_alt(startNode, timeDistance, graph)
{

  let i;
  let startTime, endTime;
  let currentNode, nextNodeId;
  let scanBegin, scanEnd;
  

  const currentQueue0 = new FastPriorityQueue(function(a, b) {
    return a.time < b.time;
  });

  //시작점의 정보를 입력

  solution[startNode] = 0;
  predecessor[startNode] = -1;
  let ndq = { id:startNode, time:0 };
  currentQueue0.add(ndq);
  let maxSize = 0;

  let cnt = 0;

  while (!currentQueue0.isEmpty()) {

    const currentNodeQ = currentQueue0.peek();
    //console.log("currentNodeQ:",currentNodeQ);
    currentNode = currentNodeQ.id;
    startTime = currentNodeQ.time;

    scanBegin = graph.rowOffset[currentNode];
    scanEnd = graph.rowOffset[currentNode + 1];

    //console.log(scanBegin, scanEnd);
    for (i = scanBegin; i < scanEnd; i++) {

      nextNodeId = graph.colIndex[i];

      endTime = startTime + graph.value[i];			

      if (endTime < timeDistance) {

        if (solution[nextNodeId] > endTime) {
          solution[nextNodeId] = endTime;
          predecessor[nextNodeId] = currentNode;
          ndq = { id:nextNodeId, time:endTime };
          currentQueue0.add(ndq);
          if (maxSize<currentQueue0.size) maxSize = currentQueue0.size;
        }
      }
    }
    currentQueue0.poll();
    //console.log(currentQueue);
    cnt++;
  } //while currentQueue >0
  console.log("cnt:",cnt);
  console.log("maxSize:",maxSize);
}

//https://github.com/luciopaiva/heapify
function solveServiceAreaFromNode(startNode, timeDistance, graph)
{

  let i;
  let startTime, endTime;
  let currentNode, nextNodeId;
  let scanBegin, scanEnd;
  
  //priority_queue<NodeQ, vector<NodeQ>, cmpQ> currentQueue;
  //const currentQueue = new MinQueue(3000,[],[], Uint32Array, Float32Array);

  currentQueue1.clear();
  //시작점의 정보를 입력

  solution[startNode] = 0;
  predecessor[startNode] = -1;
  //let ndq = { id:startNode, time:0 };
  //currentQueue.add(ndq);
  currentQueue1.push(startNode, 0);
  let maxSize = 0;

  let cnt = 0;

  while (currentQueue1.size>0) {

    currentNode = currentQueue1.peek();
    startTime = currentQueue1.peekPriority();
    //console.log("currentNodeQ:",currentNodeQ);
    // currentNode = currentNodeQ.id;
    // startTime = currentNodeQ.time;

    scanBegin = graph.rowOffset[currentNode];
    scanEnd = graph.rowOffset[currentNode + 1];

    //console.log(scanBegin, scanEnd);
    for (i = scanBegin; i < scanEnd; i++) {

      nextNodeId = graph.colIndex[i];

      endTime = startTime + graph.value[i];			

      if (endTime < timeDistance) {

        if (solution[nextNodeId] > endTime) {
          solution[nextNodeId] = endTime;
          predecessor[nextNodeId] = currentNode;
          //ndq = { id:nextNodeId, time:endTime };
          currentQueue1.push(nextNodeId,endTime );
          if (maxSize<currentQueue1.size) maxSize = currentQueue1.size;
        }
      }
    }
    currentQueue1.pop();
    //console.log(currentQueue);
    cnt++;
  } //while currentQueue >0
  console.log("cnt:",cnt);
  console.log("maxSize:",maxSize);
}


//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////


function resize(canvas) {



  // 브라우저에서 canvas가 표시되는 크기 탐색
  var displayWidth = canvas.clientWidth;
  var displayHeight = canvas.clientHeight;

  // canvas가 같은 크기가 아닐 때 확인
  if (canvas.width != displayWidth ||
      canvas.height != displayHeight) {

      // canvas를 동일한 크기로 수정
      canvas.width = displayWidth;
      canvas.height = displayHeight;
  }


}

function initWebGL() {

  try {
    // Try to grab the standard context. If it fails, fallback to experimental.
    gl = canvas.getContext("webgl2", { stencil: true });
  }
  catch (e) { }
  
  // If we don't have a GL context, give up now
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
    gl = null;
  }  
  resize(canvas);



}


function initIsochrone() {

  const dpoints = new Array(nodeMap.length);
  //var position = new Array(nodeData.length*2);
  //var distance = new Array(nodeData.length);
  for (let i=0; i<nodeMap.length ; i++) {
      dpoints[i] = [nodeMap[i].x, nodeMap[i].y];
      //position[i*2+0] = nodeData[i].x;
      //position[i*2+1] = nodeData[i].y;
      //distance[i] = 999999;
  }

  const delaunay = Delaunator.from(dpoints);
  //console.log(delaunay.triangles);
  
  const triangleIndex = new Uint32Array(delaunay.triangles.length);
  for (var i=0 ; i<delaunay.triangles.length ; i++) {
      triangleIndex[i] = delaunay.triangles[i];
  }

  console.log(delaunay);

  isochrone.numObj = nodeMap.length;
  isochrone.numIndex = delaunay.triangles.length;


  const isochroneData = getIsochroneData();

  isochrone.setShader(isochroneData.vert, isochroneData.frag);
  isochrone.setProjectionViewMatrix("projection","view");
  isochrone.setUniformLonLat("lonLatUnitTime");
  isochrone.setUniformVar0("info0");
  isochrone.setUniformVar1("info1");



  isochrone.createBuffer();
  isochrone.setVertexBufer();
  isochrone.setIndexBufer(triangleIndex);


  console.log("shader current!!");

}




function getIsochroneData() {


  const vert =`#version 300 es
  #define PI 3.14159265358979323846
  #define PI_4 0.785398163397448309615
  #define DEGREES_TO_RADIANS 0.0174532925199432957
  #define TILE_SIZE 512.0
  #define C149_0 0.010204 //텍스쳐 좌표 주의!!
  #define C149_1 0.989796 //텍스쳐 좌표 주의!!
  uniform mat4 projection;
  uniform mat4 view;
  uniform vec4 lonLatUnitTime;
  uniform vec4 textureCoord;

  //uniform sampler2D texture0;
  //uniform sampler2D texture1;

  out vec2 vTexCoord;

  vec2 lngLatToWorld(float lng, float lat) {
    float lambda2 = lng * DEGREES_TO_RADIANS;
    float phi2 = lat * DEGREES_TO_RADIANS;
    float x = (TILE_SIZE * (lambda2 + PI)) / (2.0 * PI);
    float y = (TILE_SIZE * (PI + log(tan(PI_4 + phi2 * 0.5)))) / (2.0 * PI);
    return vec2(x, y);
  }

  vec4 vx = vec4(0.0, 1.0, 0.0, 1.0);
  vec4 vy = vec4(0.0, 0.0, 1.0, 1.0);


  //vec4 tx = vec4(C149_0, C149_1, C149_0, C149_1);
  //vec4 ty = vec4(C149_0, C149_0, C149_1, C149_1);




  void main() {

    //vec4 raw0 = texture(texture0, vec2(0.5,0.5));

    vec4 tx = vec4(textureCoord.x, textureCoord.z, textureCoord.x, textureCoord.z);
    vec4 ty = vec4(textureCoord.y, textureCoord.y, textureCoord.w, textureCoord.w);

    float x = vx[gl_VertexID];
    float y = vy[gl_VertexID];
    float posx = lonLatUnitTime.x + x * (lonLatUnitTime.z * 48.0);
    float posy = lonLatUnitTime.y + y * (lonLatUnitTime.z * 48.0);
    vec2 pos = lngLatToWorld(posx,posy);
    gl_Position = projection * view * vec4(pos, 0.0, 1.0);
    
    float texx = tx[gl_VertexID];
    float texy = ty[gl_VertexID];
    vTexCoord = vec2(texx, texy);
  }
  `;
  const frag =`#version 300 es
  precision highp float;

  in vec2 vTexCoord;
  uniform sampler2D texture0;
  uniform sampler2D texture1;
  uniform vec4 lonLatUnitTime;
  uniform ivec4 info1; //x:dataSelectedNum

  vec4 mako[10] = vec4[](
    vec4(36, 22, 42, 50),
    vec4(56, 42, 84, 100),
    vec4(63, 63, 128, 150),
    vec4(56, 93, 154, 200),
    vec4(52, 121, 161, 255),
    vec4(52, 151, 168, 255),
    vec4(61, 179, 172, 255),
    vec4(98, 207, 172, 255),
    vec4(170, 226, 189, 255),
    vec4(218, 242, 225, 255)
  );


  vec4 inferno[10] =vec4[](
    vec4(0, 0, 4, 50),
    vec4(27, 12, 65, 100),
    vec4(74, 12, 107, 150),
    vec4(120, 28, 109, 200),
    vec4(165, 44, 96, 255),
    vec4(207, 68, 70, 255),
    vec4(237, 105, 37, 255),
    vec4(251, 155, 6, 255),
    vec4(247, 209, 61, 255),
    vec4(252, 255, 164, 255)
  );

  vec4 turbo[16] = vec4[](
    vec4(48, 18, 59, 50),
    vec4(64, 67, 166, 100),
    vec4(70, 112, 232, 150),
    vec4(62, 155, 254, 200),
    vec4(33, 196, 225, 255),
    vec4(26, 228, 182, 255),
    vec4(70, 247, 131, 255),
    vec4(135, 254, 77, 255),
    vec4(185, 245, 52, 255),
    vec4(225, 220, 55, 255),
    vec4(249, 186, 56, 255),
    vec4(253, 140, 39, 255),
    vec4(239, 90, 17, 255),
    vec4(214, 52, 5, 255),
    vec4(174, 24, 1, 255),
    vec4(122, 4, 2, 255)
  );
  
  vec4 viridis[10] = vec4[](
    vec4(68, 1, 84, 50),
    vec4(72, 40, 120, 100),
    vec4(62, 73, 137, 150),
    vec4(49, 104, 142, 200),
    vec4(38, 130, 142, 255),
    vec4(31, 158, 137, 255),
    vec4(53, 183, 121, 255),
    vec4(110, 206, 88, 255),
    vec4(181, 222, 43, 255),
    vec4(253, 231, 37, 255)
  );

  vec4 getGradient10(vec4[10] gradient, float t) {
    int idx = int(t * 9.0);
    float dt = fract(t * 9.0);
    vec4 color0 = gradient[idx];
    vec4 color1 = gradient[min(idx+1, 9)];
    vec4 color = mix(color0, color1, dt) / 255.0;
    return color;
  }

  vec4 getGradient16(vec4[16] gradient, float t) {
    int idx = int(t * 15.0);
    float dt = fract(t * 15.0);
    vec4 color0 = gradient[idx];
    vec4 color1 = gradient[min(idx+1, 15)];
    vec4 color = mix(color0, color1, dt) / 255.0;
    return color;
  }
  
  out vec4 outColor;
  vec2 decodeUV(vec4 raw) {
    float u = (raw.r *256.0*255.0 + raw.g * 255.0)-32767.0;
    float v = (raw.b *256.0*255.0 + raw.a * 255.0)-32767.0;
    return vec2(u / 10000.0, v/10000.0);
  }

  vec2 decodeSurfElevationTemperature(vec4 raw) {
    float u = (raw.r *256.0*255.0 + raw.g * 255.0)-30000.0;    
    float v = (raw.b *256.0*255.0 + raw.a * 255.0)-5000.0;    
    return vec2(u/1000.0,v/1000.0); 
  }

  
  vec2 decodeSalinity(vec4 raw) {
    float u = (raw.r *256.0*255.0 + raw.g * 255.0)-1000.0;    
    float v = (raw.b *256.0*255.0 + raw.a * 255.0)-1000.0;    
    return vec2(u/1000.0,v/1000.0); 
  }

  void main(void) {
    vec4 raw0 = texture(texture0, vTexCoord);
    vec4 raw1 = texture(texture1, vTexCoord);
    int category = info1.x;
    vec4 c;
    if (category == 0) {
      vec2 uv0 = decodeUV(raw0); 
      vec2 uv1 = decodeUV(raw1);
      float t =  lonLatUnitTime.a; //0~1
      vec2 uv = mix(uv0, uv1, t);
      float strength = length(uv)/1.6;
      c = getGradient10(mako, clamp(strength, 0.0, 1.0));
      //c = getGradientMako(clamp(strength, 0.0, 1.0));
    } else if (category == 1) {
      vec2 uv0 = decodeSurfElevationTemperature(raw0); 
      vec2 uv1 = decodeSurfElevationTemperature(raw1);
      float t =  lonLatUnitTime.a; //0~1
      vec2 uv = mix(uv0, uv1, t);
      float strength = (uv.x+5.0)/10.0;
      c = getGradient10(inferno, clamp(strength, 0.0, 1.0));
    } else if (category == 2) {
      vec2 uv0 = decodeSurfElevationTemperature(raw0); 
      vec2 uv1 = decodeSurfElevationTemperature(raw1);
      float t =  lonLatUnitTime.a; //0~1
      vec2 uv = mix(uv0, uv1, t);
      float strength = (uv.y+0.0)/30.0;
      c = getGradient16(turbo, clamp(strength, 0.0, 1.0));
    } else if (category == 3) {
      vec2 uv0 = decodeSalinity(raw0); 
      vec2 uv1 = decodeSalinity(raw1);
      float t =  lonLatUnitTime.a; //0~1
      vec2 uv = mix(uv0, uv1, t);
      float strength = (uv.x+0.0)/40.0;
      c = getGradient10(viridis, clamp(strength, 0.0, 1.0));
    }
    
    outColor = c*vec4(1,1,1,0.8);
  }

  `;  

  return {vert, frag};
}
