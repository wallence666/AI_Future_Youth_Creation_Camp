/* geo.js — 座標與距離工具（由 js/geo.js 原樣遷入 map/，行為不變）
 * 底圖（智圖 Geoq / 騰訊系）採用 GCJ-02 火星座標，POI 數據為 WGS-84，
 * 上圖前需統一轉換；若切換到 OSM/Carto 等 WGS-84 底圖則不轉。
 * 轉換算法為互聯網公開的 eviltransform 標準實現。
 */
(function (global) {
  const PI = 3.1415926535897932384626;
  const A = 6378245.0;           // 克拉索夫斯基橢球長半軸
  const EE = 0.00669342162296594323; // 偏心率平方

  function outOfChina(lng, lat) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }
  function transformLat(lng, lat) {
    let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }
  function transformLng(lng, lat) {
    let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
  }
  function wgs84ToGcj02(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
    return [lng + dLng, lat + dLat];
  }

  /** Haversine 距離（米），WGS-84 下計算 */
  function distanceM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * PI / 180;
    const dLng = (lng2 - lng1) * PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * PI / 180) * Math.cos(lat2 * PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /** 距離顯示格式化 */
  function fmtDistance(m) {
    if (m == null || !isFinite(m)) return '';
    return m < 950 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km';
  }

  // GCJ-02 → WGS-84：以正向偏移做一階近似（誤差 <1m，選點用途足夠）
  function gcj02ToWgs84(lng, lat) {
    const [glng, glat] = wgs84ToGcj02(lng, lat);
    return [lng * 2 - glng, lat * 2 - glat];
  }
  
  global.Geo = { wgs84ToGcj02, gcj02ToWgs84, distanceM, fmtDistance };
})(window);
