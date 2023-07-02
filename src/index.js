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

TextLayer.fontAtlasCacheLimit = 10;

mapboxgl.accessToken = 'pk.eyJ1Ijoic2JraW00MjciLCJhIjoiY2o4b3Q0aXd1MDdyMjMzbnRxYTdvdDZrbCJ9.GCHi6-mDGEkd3F-knzSfRQ';

{
  const top = 0;
  const parent = i => ((i + 1) >>> 1) - 1;
  const left = i => (i << 1) + 1;
  const right = i => (i + 1) << 1;

  class PriorityQueue {
    constructor(comparator = (a, b) => a > b) {
      this._heap = [];
      this._comparator = comparator;
    }
    size() {
      return this._heap.length;
    }
    isEmpty() {
      return this.size() == 0;
    }
    peek() {
      return this._heap[top];
    }
    push(...values) {
      values.forEach(value => {
        this._heap.push(value);
        this._siftUp();
      });
      return this.size();
    }
    pop() {
      const poppedValue = this.peek();
      const bottom = this.size() - 1;
      if (bottom > top) {
        this._swap(top, bottom);
      }
      this._heap.pop();
      this._siftDown();
      return poppedValue;
    }
    replace(value) {
      const replacedValue = this.peek();
      this._heap[top] = value;
      this._siftDown();
      return replacedValue;
    }
    _greater(i, j) {
      return this._comparator(this._heap[i], this._heap[j]);
    }
    _swap(i, j) {
      [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
    }
    _siftUp() {
      let node = this.size() - 1;
      while (node > top && this._greater(node, parent(node))) {
        this._swap(node, parent(node));
        node = parent(node);
      }
    }
    _siftDown() {
      let node = top;
      while (
        (left(node) < this.size() && this._greater(left(node), node)) ||
        (right(node) < this.size() && this._greater(right(node), node))
      ) {
        let maxChild = (right(node) < this.size() && this._greater(right(node), left(node))) ? right(node) : left(node);
        this._swap(node, maxChild);
        node = maxChild;
      }
    }
  }
  window.PriorityQueue=PriorityQueue;
}




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





  ];


  deckOverlay.setProps({
    layers : layers
  });  
 

}



//https://stackoverflow.com/questions/42919469/efficient-way-to-implement-priority-queue-in-javascript


// Default comparison semantics
const queue = new PriorityQueue();
queue.push(10, 20, 30, 40, 50);
console.log('Top:', queue.peek()); //=> 50
console.log('Size:', queue.size()); //=> 5
console.log('Contents:');
while (!queue.isEmpty()) {
  console.log(queue.pop()); //=> 40, 30, 20, 10
}

// Pairwise comparison semantics
const pairwiseQueue = new PriorityQueue((a, b) => a[1] > b[1]);
pairwiseQueue.push(['low', 0], ['medium', 5], ['high', 10]);
console.log('\nContents:');
while (!pairwiseQueue.isEmpty()) {
  console.log(pairwiseQueue.pop()[0]); //=> 'high', 'medium', 'low'
}


//https://github.com/lemire/FastPriorityQueue.js/
var x = new FastPriorityQueue();
x.add(1);
x.add(0);
x.add(5);
x.add(4);
x.add(3);
x.peek(); // should return 0, leaves x unchanged
x.size; // should return 5, leaves x unchanged
while (!x.isEmpty()) {
  console.log(x.poll());
} // will print 0 1 3 4 5
x.trim(); // (optional) optimizes memory usag



var x = new FastPriorityQueue(function(a, b) {
  return a > b;
});
x.add(1);
x.add(0);
x.add(5);
x.add(4);
x.add(3);
while (!x.isEmpty()) {
  console.log(x.poll());
} // will print 5 4 3 1 0




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
    nodeMap[d.id] =  {x:d.x, y:d.y, canBeStartNode : d.canBeStartNode};
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
  console.log(nodeMap, linkData);
  return {nodeMap, linkData};
})().then( ({nodeMap, linkData}) => {
  console.log(nodeMap, linkData);
  setCSRGraph(nodeMap, linkData);
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

function solveServiceAreaFromNode(startNode, timeDistance, graph)
{

  let i;
  let startTime, endTime;
  let currentNode, nextNodeId;
  let scanBegin, scanEnd;
  
  //priority_queue<NodeQ, vector<NodeQ>, cmpQ> currentQueue;
  const currentQueue = new FastPriorityQueue(function(a, b) {
    return a.time < b.time;
  });
  //시작점의 정보를 입력

  solution[startNode] = 0;
  predecessor[startNode] = -1;
  let ndq = { id:startNode, time:0 };
  currentQueue.add(ndq);

  let cnt = 0;

  while (!currentQueue.isEmpty()) {

    const currentNodeQ = currentQueue.peek();
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
          currentQueue.add(ndq);
        }
      }
    }
    currentQueue.poll();
    //console.log(currentQueue);
    cnt++;
  } //while currentQueue >0
  console.log("cnt:",cnt);
}




function solveServiceAreaFromNode_alt(startNode, timeDistance, graph)
{

  let i;
  let startTime, endTime;
  let currentNode, nextNodeId;
  let scanBegin, scanEnd;
  
  //priority_queue<NodeQ, vector<NodeQ>, cmpQ> currentQueue;
  const currentQueue = new PriorityQueue(function(a, b) {
    return a.time < b.time;
  });
  //시작점의 정보를 입력

  solution[startNode] = 0;
  predecessor[startNode] = -1;
  let ndq = { id:startNode, time:0 };
  currentQueue.push(ndq);

  let cnt = 0;

  while (!currentQueue.isEmpty()) {

    const currentNodeQ = currentQueue.peek();
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
          currentQueue.push(ndq);
        }
      }
    }
    currentQueue.pop();
    //console.log(currentQueue);
    cnt++;
  } //while currentQueue >0
  console.log("cnt:",cnt);
}