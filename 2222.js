let deletedLayerID = []
async function x() {
  const re = await App.Scene.GetByCustomId(["my-geolayer-id"]);
  if (re.success && re.result.length > 0) {
    await re.result[0].Delete();
  }
  const entityObj = new App.GeoLayer({//创建图层对象
    "geoLayerUrl": "WFS:http://42.121.160.120:8080/geoserver/cimlite/ows?",// WFS地址前需标注"WFS:"
    "geoLayerType": "WFS",// shp,WFS,geojson
    "geoLayerParams": {
      "layerHeightOffset": 100, // 初始高度，单位m
      "serviceLayerName": "cimlite:building",
      "featureType": "Polygon",// Polygon/line/point
      "needGCJOffset": false,
      "batchFeatureNum": 40 // 合批处理要素数量
    },
    "geoFeatureStyle": {
      "styleDesc": "Default",// StyleDesc用于描述材质和纹理等固定表现,支持Default,Default1
      "polygonStyle": {
        "filledColor": "08baffff",// 多边形填充颜色
        "bOutline": true,// 是否显示轮廓
        "outlineColor": "5366feff",// 轮廓颜色
        "outlineWidth": 1,// 轮廓宽度
        "bExtrude": true,// 是否拉伸
        "extrudeHeight": 100,// 图层整体拉伸高度
        "extrudeHeightField": "height"// 拉伸高度对应属性值,与extrudeHeight属性二选一
      }
    },
    "customId": "my-geolayer-id",
  });
  const res = await App.Scene.Add(entityObj);
  console.log(res);

  if (res.success) {
    //判断图层是否是待删除图层
    if (deletedLayerID.includes("my-geolayer-id")) {
      console.warn("进入删除逻辑")
      const re = await App.Scene.GetByCustomId(["my-geolayer-id"]);
      console.warn(re)
      if (re.success && re.result.length > 0) {
        re.result[0].Delete();
      }
    }
  }
}


x()

//延时0.2秒，在图层添加完成前 执行删除逻辑，模拟用户操作
setTimeout(() => {
  const re = App.Scene.GetByCustomId(["my-geolayer-id"]);
  if (re.success && re.result.length > 0) {
    re.result[0].Delete();
  } else {
    //如果删除失败，将图层添加到待删除数组中
    console.warn("请先添加!");
    deletedLayerID.push("my-geolayer-id")
  }
}, 200);