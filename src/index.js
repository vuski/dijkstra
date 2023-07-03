import {Deck}  from '@deck.gl/core';
import {ScatterplotLayer, PathLayer,PolygonLayer,TextLayer, BitmapLayer, SolidPolygonLayer, GeoJsonLayer} from '@deck.gl/layers';
import {DataFilterExtension} from '@deck.gl/extensions';
import {WebMercatorViewport,} from '@deck.gl/core';
import {CSVLoader} from '@loaders.gl/csv';
import {JSONLoader} from '@loaders.gl/json'
import {TileLayer} from '@deck.gl/geo-layers';
import {load} from '@loaders.gl/core';
import {MapboxOverlay} from '@deck.gl/mapbox';
//const {JSONLoader, load} = json; 
import { mat4 , vec4} from 'gl-matrix';
import mapboxgl from 'mapbox-gl';
import MapboxLanguage from '@mapbox/mapbox-gl-language';
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

    this.info0;
    this.info1;
    this.vertexAttrib;

    this.numObj;
    this.numIndex;

    this.posAttrLoc;
    this.distAttrLoc;
    // this.framebuffer;
    // this.framebufferTexture;
  }



  
  setVertexBufer(position) {
    this.vertexBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBO);
    gl.bufferData(gl.ARRAY_BUFFER, 4 * 3 * this.numObj, gl.DYNAMIC_DRAW);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(position));

    this.posAttrLoc = gl.getAttribLocation(this.shader, "pos"); 
    this.distAttrLoc = gl.getAttribLocation(this.shader, "distance"); 
    gl.enableVertexAttribArray(this.posAttrLoc);   
    gl.enableVertexAttribArray(this.distAttrLoc);   

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

  }

  updateSolutionBuffer(solution) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 4 * 2 * this.numObj, new Float32Array(solution));
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  setIndexBufer(indexArray) {

    this.indexBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,  this.indexBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,  new Uint32Array(indexArray), gl.STATIC_DRAW);
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


  bindUniform(__projectionMatrix, __viewMatrix) {

    gl.uniformMatrix4fv(this.projectionMatrixLoc, false, __projectionMatrix);
    gl.uniformMatrix4fv(this.viewMatrixLoc, false, __viewMatrix);
  }

  bindUniformLonLatUnit(lon, lat, unit, time) {
    gl.uniform4f(this.lonLatUnitLoc, lon, lat, unit, time);
  }

  bindUniformVar0(currentTime, currentTimeLimit) {
    gl.uniform4f(this.info0, currentTime, currentTimeLimit, 0.0, 0.0);
  }

  bindUniformVar1(gradientType) {
    gl.uniform4i(this.info1, gradientType, 0, 0, 0);
  }


  drawElement() {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBO);
    gl.vertexAttribPointer(this.posAttrLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribPointer(this.distAttrLoc, 1, gl.FLOAT, false, 0, 4*2* this.numObj);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBO);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT ,0);
  }

  bindVertexBuffer() {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBO);
    gl.vertexAttribPointer(this.posAttrLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribPointer(this.distAttrLoc, 1, gl.FLOAT, false, 0, 4*2* this.numObj);
  }
  drawLineElement() {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBO);
    gl.drawElements(gl.LINES, this.indexCount, gl.UNSIGNED_INT ,0);
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
//const canvas = document.getElementById('container');

const isochrone = new DrawObject();
const isochroneLine = new DrawObject();
initWebGL();

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


const map = new mapboxgl.Map({
  container: 'container', // container ID
  //style: 'mapbox://styles/mapbox/streets-v11', // style URL
  style:  'mapbox://styles/sbkim427/cl6ool43r003o14kwmd8ogdwc',
  center: [ 127.6, 35.7], // starting position [lng, lat]
  zoom: 6, // starting zoom 
  //projection: 'globe' // display the map as a 3D globe
})

const deckOverlay =  new MapboxOverlay({
  //interleaved: false,
  layers: []
}); 

initMap(map);

function initMap(map) { 

  //map.dragRotate.disable(); 
  //map.touchZoomRotate.disableRotation();    
  map.addControl(new MapboxLanguage({
      defaultLanguage: 'ko'    
    },
  ));


  deckOverlay.setProps({
    onAfterRender: () => {
      if (webglOnLoad) drawGLcontext();
      //console.log('Render finished');
    }
  });

  map.on('zoom', () => {
  
    //renderDeckGL();
  
  });
  map.on('move', () => {
    
  });
  
  map.addControl(deckOverlay);
  
// map.on('style.load', () => {
//     map.setFog({}); // Set the default atmosphere style
// });
}




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


const currentQueue = new MinQueue(3000,[],[], Uint32Array, Float32Array);

let webglOnLoad = false;
let currentTime = 0.0;

// Quadtree 생성
let quadtree = d3.quadtree()
  .x(d => d.x)  // x 좌표로 접근
  .y(d => d.y)  // y 좌표로 접근

let nearestPointMouse = 0;
let animationID;
let gradientType = 0;

/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

window.addEventListener("keydown", (e) => {
  console.log(e);
  if (e.key=='1') {
    gradientType++;
    gradientType = gradientType % 4;
  }
  if (e.key=='2') {
   
  }
  if (e.key=='3') {
    
  }
  //renderDeckGL();
});


window.addEventListener("mousemove", (e) => {
  //console.log(e);
  const mousex = e.clientX;
  const mousey = e.clientY;
  const lngLat = map.unproject([mousex, mousey]);

  let nearestPoint = quadtree.find(lngLat.lng, lngLat.lat);
  nearestPointMouse = nearestPoint.id;


  //const startTime = performance.now();

  resetNetwork();
  //console.log(solution);
  solveServiceAreaFromNode(nearestPointMouse, currentTimeLimit, graph);
  isochrone.updateSolutionBuffer(solution);
  //const endTime = performance.now();
  //const executionTime = endTime - startTime;     
  //console.log(`실행 시간: ${executionTime}ms`);
  //console.log(solution);
  currentTime = 0.0;

  //console.log(nearestPoint);  

  //console.log(lngLat);  // 변환된 경위도 좌표 출력


  //renderDeckGL();
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
  //update();
});

let addTimeUnit = 2.0;
let currentTimeLimit = 300;
function renderAll() {

  currentTime += addTimeUnit;
  if (currentTime > currentTimeLimit) currentTime = 0;

  renderDeckGL();
  
  animationID = requestAnimationFrame(renderAll);

}

function renderDeckGL() {

  const layers =  [

    new ScatterplotLayer({
      id: 'trafficNode',
      data: nodeMap,
      
      // Styles
      filled: true,

      radiusMinPixels: 1,
      //sizeMaxPixels: 10,
      radiusScale: 1,
      getPosition: d => [d.x, d.y],
      getRadius: d => {
        if (d.id ==nearestPointMouse) return 8;
        else return 1;
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
        return [30, 20, 10];
      },
      updateTriggers: {
        // This tells deck.gl to recalculate radius when `currentYear` changes
        getRadius : [nearestPointMouse]       
      },
      // Interactive props      
      visible : false,
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
let linkMap;

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
  linkMap = new Uint32Array(linkRaw.length*2); //webgl draw용
  let idx = 0;
  for (const d of linkRaw) {
    linkData.push({fromNode:d.fromNode, toNode:d.toNode, time : d.timeFT});
    linkData.push({fromNode:d.toNode, toNode:d.fromNode, time : d.timeTF});

    linkMap[idx++] = d.fromNode;
    linkMap[idx++] = d.toNode;
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

  //노드를 검색해야 하므로 쿼드트리에 집어넣기
  const nodeMap_beginable = new Array();
  for (let node of nodeMap) {
    if (node.canBeStartNode==1) nodeMap_beginable.push(node);
  }
  quadtree.addAll(nodeMap_beginable);
  //let nearestPoint = quadtree.find(127.045353, 37.514091);
  //console.log(nearestPoint);  

  //console.log(nodeMap, linkData);
  setCSRGraph(nodeMap, linkData);

  initIsochrone();

  
  animationID = requestAnimationFrame(renderAll); 
  //console.log(graph);

  //const startNodes = [178016, 104452, 342160];

  // for (let startNode of  startNodes) {
  //   const startTime = performance.now();

  //   resetNetwork();
  //   //console.log(solution);
  //   solveServiceAreaFromNode(startNode, 300, graph);
  //   const endTime = performance.now();
  //   const executionTime = endTime - startTime;     
  //   console.log(`실행 시간: ${executionTime}ms`);
  //   console.log(solution);
  // }
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

  solution = new Float32Array(graph.numNode).fill(9999999999);;
  predecessor = new Array(graph.numNode).fill(Number.MAX_SAFE_INTEGER);
  
  
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

  currentQueue.clear();
  //시작점의 정보를 입력

  solution[startNode] = 0;
  predecessor[startNode] = -1;
  //let ndq = { id:startNode, time:0 };
  //currentQueue.add(ndq);
  currentQueue.push(startNode, 0);
  let maxSize = 0;

  let cnt = 0;

  while (currentQueue.size>0) {

    currentNode = currentQueue.peek();
    startTime = currentQueue.peekPriority();
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
          currentQueue.push(nextNodeId,endTime );
          if (maxSize<currentQueue.size) maxSize = currentQueue.size;
        }
      }
    }
    currentQueue.pop();
    //console.log(currentQueue);
    cnt++;
  } //while currentQueue >0
  //console.log("cnt:",cnt);
 // console.log("maxSize:",maxSize);
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
  const position = new Float32Array(nodeMap.length*2);
  //var distance = new Array(nodeData.length);
  for (let i=0; i<nodeMap.length ; i++) {
      dpoints[i] = [nodeMap[i].x, nodeMap[i].y];
      position[i*2+0] = nodeMap[i].x;
      position[i*2+1] = nodeMap[i].y;
      //distance[i] = 999999;
  }

  const delaunay = Delaunator.from(dpoints);
  //console.log(delaunay.triangles);
  
  const triangleIndex = new Uint32Array(delaunay.triangles.length);
  for (var i=0 ; i<delaunay.triangles.length ; i++) {
      triangleIndex[i] = delaunay.triangles[i];
  }

  //console.log(delaunay);

  isochrone.numObj = nodeMap.length;

  const isochroneData = getIsochroneData();

  isochrone.setShader(isochroneData.vert, isochroneData.frag);
  isochrone.setProjectionViewMatrix("projection","view");
  //isochrone.setUniformLonLat("lonLatUnitTime");
  isochrone.setUniformVar0("info0");
  isochrone.setUniformVar1("info1");
  //console.log("position:", position);
  isochrone.setVertexBufer(position);
  isochrone.setIndexBufer(triangleIndex);






  isochroneLine.numObj = nodeMap.length;
  const isochroneLineData = getIsochroneLineData();

  isochroneLine.setShader(isochroneLineData.vert, isochroneLineData.frag);
  isochroneLine.setProjectionViewMatrix("projection","view");
  isochroneLine.setUniformVar0("info0");
  isochroneLine.setUniformVar1("info1");
  isochroneLine.setIndexBufer(linkMap);


  console.log("shader current!!");
  webglOnLoad = true;
}

function  drawGLcontext() {

  //console.log(deckOverlay._deck);
  //console.log(map);
  //const viewport = deckOverlay.getViewports()[0];

  //const viewport = new WebMercatorViewport(deckOverlay._deck.viewManager.viewState);
  const viewport = deckOverlay._deck.viewManager._viewports[0];
  
  const __projectionMatrix = mat4.create(); // 빈 mat4 행렬 생성
  mat4.copy(__projectionMatrix, viewport.projectionMatrix);
  const __viewMatrix = mat4.create(); // 빈 mat4 행렬 생성
  mat4.copy(__viewMatrix, viewport.viewMatrix);

  //console.log(deckOverlay._deck);
  //console.log(viewport.projectionMatrix);
  //console.log(viewport.viewMatrix);

  //console.log(viewport.project([126.7, 36.7]));
    
  // Clear the canvas
  // 스텐실 테스트를 활성화합니다.
  //gl.enable(gl.STENCIL_TEST);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


  gl.clearColor(0,0,0.0,0.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT); 
  gl.viewport(0,0,canvas.width,canvas.height);


  // /////////////////////////////////////////////////////////////
  // // 배경 그라데이션 이미지 그리기
  if (true) {
    isochrone.useShader();
    isochrone.bindUniform(__projectionMatrix, __viewMatrix);  
    isochrone.bindUniformVar0(currentTime, currentTimeLimit);
    isochrone.bindUniformVar1(gradientType);
    isochrone.drawElement();
  }


  isochroneLine.useShader();
  isochroneLine.bindUniform(__projectionMatrix, __viewMatrix);
  

  // isochrone.bindUniformLonLatUnit(d0.lon, d0.lat, d0.unit, time);
  // isochrone.bindUniformTextureCoord(coord.xmin, coord.ymin, coord.xmax, coord.ymax);
  // isochrone.bindTwoTextures( textureWhole0[vidx],  textureWhole1[vidx]);   
  isochroneLine.bindUniformVar0(currentTime, currentTimeLimit);
  isochroneLine.bindUniformVar1(gradientType);
  isochrone.bindVertexBuffer();
  isochroneLine.drawLineElement();


}


function getIsochroneData() {


  const vert =`#version 300 es
  #define PI 3.14159265358979323846
  #define PI_4 0.785398163397448309615
  #define DEGREES_TO_RADIANS 0.0174532925199432957
  #define TILE_SIZE 512.0

  in vec2 pos;
  in float distance;


  uniform mat4 projection;
  uniform mat4 view;
  //uniform vec4 lonLatUnitTime;



  out float dist;

  vec2 lngLatToWorld(float lng, float lat) {
    float lambda2 = lng * DEGREES_TO_RADIANS;
    float phi2 = lat * DEGREES_TO_RADIANS;
    float x = (TILE_SIZE * (lambda2 + PI)) / (2.0 * PI);
    float y = (TILE_SIZE * (PI + log(tan(PI_4 + phi2 * 0.5)))) / (2.0 * PI);
    return vec2(x, y);
  }




  void main() {    

    vec2 posWorld = lngLatToWorld(pos.x,pos.y);
    gl_Position = projection * view * vec4(posWorld, 0.0, 1.0);    

    dist = distance;
  }
  `;
  const frag =`#version 300 es
  precision highp float;

  in float dist;


  uniform vec4 info0;
  uniform ivec4 info1;

  vec4 mako[10] = vec4[](
    vec4(36, 22, 42, 250),
    vec4(56, 42, 84, 255),
    vec4(63, 63, 128, 255),
    vec4(56, 93, 154, 255),
    vec4(52, 121, 161, 255),
    vec4(52, 151, 168, 255),
    vec4(61, 179, 172, 255),
    vec4(98, 207, 172, 255),
    vec4(170, 226, 189, 255),
    vec4(218, 242, 225, 255)
  );


  vec4 inferno[10] =vec4[](
    vec4(0, 0, 4, 50),
    vec4(27, 12, 65, 255),
    vec4(74, 12, 107, 255),
    vec4(120, 28, 109, 255),
    vec4(165, 44, 96, 255),
    vec4(207, 68, 70, 255),
    vec4(237, 105, 37, 255),
    vec4(251, 155, 6, 255),
    vec4(247, 209, 61, 255),
    vec4(252, 255, 164, 255)
  );

  vec4 turbo[16] = vec4[](
    vec4(48, 18, 59, 50),
    vec4(64, 67, 166, 255),
    vec4(70, 112, 232, 255),
    vec4(62, 155, 254, 255),
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
    vec4(72, 40, 120, 255),
    vec4(62, 73, 137, 255),
    vec4(49, 104, 142, 255),
    vec4(38, 130, 142, 255),
    vec4(31, 158, 137, 255),
    vec4(53, 183, 121, 255),
    vec4(110, 206, 88, 255),
    vec4(181, 222, 43, 255),
    vec4(253, 231, 37, 255)
  );

  vec4 getGradient10(vec4[10] gradient, float t) {
    t = float(int(t*9.0)) / 9.0;
    int idx = int(t * 9.0);
    float dt = fract(t * 9.0);
    vec4 color0 = gradient[idx];
    vec4 color1 = gradient[min(idx+1, 9)];
    vec4 color = mix(color0, color1, dt) / 255.0;
    return color;
  }

  vec4 getGradient16(vec4[16] gradient, float t) {
    t = float(int(t*9.0)) / 9.0;
    int idx = int(t * 15.0);
    float dt = fract(t * 15.0);
    vec4 color0 = gradient[idx];
    vec4 color1 = gradient[min(idx+1, 15)];
    vec4 color = mix(color0, color1, dt) / 255.0;
    return color;
  }
  
  out vec4 outColor;

  void main(void) {

    float currentTimeLimit = info0.y;
    float strength = dist /currentTimeLimit;
    if (strength>1.0) {
      discard;
    } else {
      int category = info1.x;
      vec4 c;
      if (category == 0) {

        
        c = getGradient10(mako, clamp(strength, 0.0, 1.0));

      } else if (category == 1) {


        c = getGradient10(inferno, clamp(strength, 0.0, 1.0));
      } else if (category == 2) {


        c = getGradient16(turbo, clamp(strength, 0.0, 1.0));
      } else if (category == 3) {


        c = getGradient10(viridis, clamp(strength, 0.0, 1.0));
      }
      
      outColor = c*vec4(1,1,1,0.95);
    }
  }

  `;  

  return {vert, frag};
}



function getIsochroneLineData() {


  const vert =`#version 300 es
  #define PI 3.14159265358979323846
  #define PI_4 0.785398163397448309615
  #define DEGREES_TO_RADIANS 0.0174532925199432957
  #define TILE_SIZE 512.0

  in vec2 pos;
  in float distance;


  uniform mat4 projection;
  uniform mat4 view;
  //uniform vec4 lonLatUnitTime;



  out float dist;

  vec2 lngLatToWorld(float lng, float lat) {
    float lambda2 = lng * DEGREES_TO_RADIANS;
    float phi2 = lat * DEGREES_TO_RADIANS;
    float x = (TILE_SIZE * (lambda2 + PI)) / (2.0 * PI);
    float y = (TILE_SIZE * (PI + log(tan(PI_4 + phi2 * 0.5)))) / (2.0 * PI);
    return vec2(x, y);
  }




  void main() {    

    vec2 posWorld = lngLatToWorld(pos.x,pos.y);
    gl_Position = projection * view * vec4(posWorld, 0.0, 1.0);    

    dist = distance;
  }
  `;
  const frag =`#version 300 es
  precision highp float;

  in float dist;


  uniform vec4 info0;
  uniform ivec4 info1;

  vec4 mako[10] = vec4[](
    vec4(36, 22, 42, 255),
    vec4(56, 42, 84, 255),
    vec4(63, 63, 128, 255),
    vec4(56, 93, 154, 255),
    vec4(52, 121, 161, 255),
    vec4(52, 151, 168, 255),
    vec4(61, 179, 172, 255),
    vec4(98, 207, 172, 255),
    vec4(170, 226, 189, 255),
    vec4(218, 242, 225, 255)
  );


  vec4 inferno[10] =vec4[](
    vec4(0, 0, 4, 255),
    vec4(27, 12, 65, 255),
    vec4(74, 12, 107, 255),
    vec4(120, 28, 109, 255),
    vec4(165, 44, 96, 255),
    vec4(207, 68, 70, 255),
    vec4(237, 105, 37, 255),
    vec4(251, 155, 6, 255),
    vec4(247, 209, 61, 255),
    vec4(252, 255, 164, 255)
  );

  vec4 turbo[16] = vec4[](
    vec4(48, 18, 59, 255),
    vec4(64, 67, 166, 255),
    vec4(70, 112, 232, 255),
    vec4(62, 155, 254, 255),
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
    vec4(68, 1, 84, 255),
    vec4(72, 40, 120, 255),
    vec4(62, 73, 137, 255),
    vec4(49, 104, 142, 255),
    vec4(38, 130, 142, 255),
    vec4(31, 158, 137, 255),
    vec4(53, 183, 121, 255),
    vec4(110, 206, 88, 255),
    vec4(181, 222, 43, 255),
    vec4(253, 231, 37, 255)
  );

  vec4 getGradient10(vec4[10] gradient, float t) {
    t = float(int(t*9.0)) / 9.0;
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

  void main(void) {

    float currentTime = info0.x;
    float currentTimeLimit = info0.y;
    float alpha = pow(dist / currentTime, 5.0); 
    float strength = dist /currentTimeLimit;
    if (strength>1.0 || currentTime < dist) {
      discard;
    } else {
      int category = info1.x;
      vec4 c;
      if (category == 0) {

        
        c = getGradient10(mako, clamp(strength, 0.0, 1.0));

      } else if (category == 1) {


        c = getGradient10(inferno, clamp(strength, 0.0, 1.0));
      } else if (category == 2) {


        c = getGradient16(turbo, clamp(strength, 0.0, 1.0));
      } else if (category == 3) {


        c = getGradient10(viridis, clamp(strength, 0.0, 1.0));
      }
      if (alpha>0.8) outColor = mix(vec4(1.0), vec4(1.0, 0.3, 0.1,alpha), (1.0-alpha)/ 0.2);
      else outColor = mix(vec4(1.0, 0.3, 0.1,alpha), c, 1.0-alpha);
      //outColor = c*vec4(0.6,0.6,0.6,alpha);
    }
  }

  `;  

  return {vert, frag};
}

