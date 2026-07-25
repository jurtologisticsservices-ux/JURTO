import React, { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { C } from "@/src/lib/theme";

export type MapPayload = {
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  driver_lat?: number | null;
  driver_lng?: number | null;
};

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#F4F4F0;}
.pin{border:2px solid #111;font-family:Menlo,monospace;font-size:10px;font-weight:900;padding:4px 6px;color:#fff;line-height:1;text-align:center;box-shadow:none;}
.pin-pickup{background:#FF4500}
.pin-dropoff{background:#111111}
.pin-driver{background:#00B85E;font-size:14px;padding:6px 8px}
.leaflet-container{background:#F4F4F0}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
const map = L.map('map', {zoomControl:false, attributionControl:false}).setView([20.5,78.9], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let pickupMarker=null, dropoffMarker=null, driverMarker=null, routeLine=null, fittedOnce=false;
function makeIcon(cls, label){
  return L.divIcon({html:'<div class="pin '+cls+'">'+label+'</div>', className:'', iconSize:[32,22], iconAnchor:[16,22]});
}
function ensurePickup(lat,lng){ if(!pickupMarker) pickupMarker=L.marker([lat,lng],{icon:makeIcon('pin-pickup','P')}).addTo(map); else pickupMarker.setLatLng([lat,lng]); }
function ensureDropoff(lat,lng){ if(!dropoffMarker) dropoffMarker=L.marker([lat,lng],{icon:makeIcon('pin-dropoff','D')}).addTo(map); else dropoffMarker.setLatLng([lat,lng]); }
function ensureDriver(lat,lng){ if(!driverMarker) driverMarker=L.marker([lat,lng],{icon:makeIcon('pin-driver','\u{1F69B}')}).addTo(map); else driverMarker.setLatLng([lat,lng]); }
function ensureRoute(){
  if(pickupMarker && dropoffMarker){
    const pts=[pickupMarker.getLatLng(), dropoffMarker.getLatLng()];
    if(!routeLine) routeLine=L.polyline(pts,{color:'#111',weight:3,dashArray:'6 6',opacity:.8}).addTo(map);
    else routeLine.setLatLngs(pts);
  }
}
function fitToVisible(){
  const pts=[];
  if(pickupMarker) pts.push(pickupMarker.getLatLng());
  if(dropoffMarker) pts.push(dropoffMarker.getLatLng());
  if(driverMarker) pts.push(driverMarker.getLatLng());
  if(pts.length>=2){ map.fitBounds(L.latLngBounds(pts),{padding:[36,36], maxZoom:15}); }
  else if(pts.length===1){ map.setView(pts[0], 14); }
}
window.updateData = function(json){
  try{
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    if(d.pickup_lat!=null && d.pickup_lng!=null) ensurePickup(d.pickup_lat, d.pickup_lng);
    if(d.dropoff_lat!=null && d.dropoff_lng!=null) ensureDropoff(d.dropoff_lat, d.dropoff_lng);
    ensureRoute();
    if(d.driver_lat!=null && d.driver_lng!=null) ensureDriver(d.driver_lat, d.driver_lng);
    if(!fittedOnce && (pickupMarker || driverMarker)){ fitToVisible(); fittedOnce=true; }
    else if(driverMarker){ /* keep view; small nudge */ }
  }catch(e){}
};
// Signal ready
setTimeout(function(){
  if(window.ReactNativeWebView && window.ReactNativeWebView.postMessage){
    window.ReactNativeWebView.postMessage('ready');
  }
  window.parent && window.parent.postMessage && window.parent.postMessage('map-ready','*');
},50);
</script>
</body></html>`;

type Props = {
  data: MapPayload;
  height?: number;
  testID?: string;
};

export default function LiveMap({ data, height = 260, testID }: Props) {
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<MapPayload | null>(null);

  const payloadJson = useMemo(() => JSON.stringify(data), [data]);

  const push = (json: string) => {
    if (Platform.OS === "web") {
      const w = iframeRef.current?.contentWindow as any;
      if (w && typeof w.updateData === "function") {
        w.updateData(json);
      } else {
        pendingRef.current = data;
      }
    } else {
      webRef.current?.injectJavaScript(`window.updateData(${JSON.stringify(json)}); true;`);
    }
  };

  useEffect(() => {
    if (!readyRef.current) {
      pendingRef.current = data;
      return;
    }
    push(payloadJson);
  }, [payloadJson]); // eslint-disable-line react-hooks/exhaustive-deps

  // For web: listen for the ready postMessage
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (ev: MessageEvent) => {
      if (ev?.data === "map-ready") {
        readyRef.current = true;
        if (pendingRef.current) push(JSON.stringify(pendingRef.current));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS === "web") {
    return (
      <View style={[styles.wrap, { height }]} testID={testID}>
        {React.createElement("iframe", {
          ref: iframeRef,
          srcDoc: HTML,
          style: { width: "100%", height: "100%", border: 0, display: "block" },
          title: "live-map",
        })}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]} testID={testID}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html: HTML }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(e) => {
          if (e.nativeEvent.data === "ready") {
            readyRef.current = true;
            if (pendingRef.current) push(JSON.stringify(pendingRef.current));
          }
        }}
        style={{ backgroundColor: C.surfaceSecondary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    overflow: "hidden",
    backgroundColor: C.surfaceSecondary,
  },
});
