/* One importer for both the local plugin and automated MCP validation. */
async function importBanner(figma, data, imageHashes = {}, position) {
  if (data.version !== 1 || !Array.isArray(data.panels)) throw new Error('Unsupported banner export version.');
  const warnings = [...(data.warnings || [])], createdNodeIds = [], fontDiagnostics = [], textDiagnostics = [];
  const track = node => { createdNodeIds.push(node.id); return node; };
  const solid = c => [{type:'SOLID',color:{r:c.r,g:c.g,b:c.b},opacity:c.a}];
  const allFonts = await figma.listAvailableFontsAsync();
  const fontMap = new Map();
  for (const panel of data.panels) for (const block of panel.layers) for (const layer of (block.type === 'text' ? [block,...(block.runs || [])] : [])) {
    const key = JSON.stringify(layer.font);
    if (fontMap.has(key)) continue;
    const family = ({WBSans:'WB Sans',InterVariable:'Inter Variable'})[layer.font.family] || layer.font.family;
    const availableAxes = await figma.getFontFamilyVariationAxes(family);
    const axes = availableAxes?.length ? availableAxes : null;
    const variations = {...layer.font.variations};
    if(axes && axes.includes('wght')) variations.wght = layer.font.weight;
    const unsupported = Object.keys(variations).filter(axis=>!axes || !axes.includes(axis));
    if (unsupported.length) warnings.push(`${family}: unsupported axes ${unsupported.join(', ')}; appearance requires review.`);
    const supported = Object.fromEntries(Object.entries(variations).filter(([axis])=>axes?.includes(axis)));
    const style = layer.font.weight >= 700 ? 'Bold' : layer.font.weight >= 500 ? 'Medium' : 'Regular';
    const exact = allFonts.find(f=>f.fontName.family===family && f.fontName.style===style);
    if(!exact && !axes)throw new Error(family.startsWith('WB Resizer Legal') ? `Install ${family==='WB Resizer Legal Condensed'?'WBResizerLegalCondensed-Regular.ttf':'WBResizerLegal-Regular.ttf'} from the Resizer app/assets folder, then reopen the plugin.` : `Missing exact font: ${family} ${style}. Install it before importing.`);
    const font = axes ? {family,variationSettings:supported} : exact.fontName;
    await figma.loadFontAsync(font);fontMap.set(key,font);
    fontDiagnostics.push({requested:layer.font,resolved:font,availableAxes:axes || [],unsupportedAxes:unsupported});
  }
  const root=track(figma.createFrame());root.name=`${data.width} × ${data.height}`;root.resize(data.width,data.height);root.fills=[];root.clipsContent=true;
  const center=figma.viewport.center || {x:0,y:0};
  root.x=position?.x ?? center.x-data.width/2;root.y=position?.y ?? center.y-data.height/2;
  try {
    for(const panel of data.panels){
      const frame=track(figma.createFrame());root.appendChild(frame);frame.name=panel.name;frame.resize(panel.width,panel.height);frame.x=panel.x;frame.y=panel.y;frame.fills=solid(panel.color);frame.clipsContent=true;
      for(const layer of panel.layers){
        let node;
        if(layer.type==='svg'){
          const payload=layer.data.split(',')[1];
          const svg=layer.data.includes(';base64,') ? String.fromCharCode(...figma.base64Decode(payload)) : decodeURIComponent(payload);
          node=track(figma.createNodeFromSvg(svg));createdNodeIds.push(...node.findAll(()=>true).map(n=>n.id));
        }else if(layer.type==='image'){
          const cachedHash=imageHashes[layer.data];
          const image=cachedHash?{hash:cachedHash}:figma.createImage(figma.base64Decode(layer.data.split(',')[1]));
          node=track(figma.createRectangle());node.fills=[{type:'IMAGE',imageHash:image.hash,scaleMode:'FILL'}];
        }else if(layer.type==='text'){
          node=track(figma.createText());node.fontName=fontMap.get(JSON.stringify(layer.font));node.fontSize=layer.fontSize;node.characters=layer.text;node.lineHeight={unit:'PIXELS',value:layer.lineHeight};node.letterSpacing={unit:'PIXELS',value:layer.letterSpacing};node.fills=solid(layer.color);node.opacity=layer.opacity;node.textAutoResize='WIDTH_AND_HEIGHT';
          for (const run of layer.runs || []) {
            if(run.end<=run.start)continue;
            node.setRangeFontName(run.start,run.end,fontMap.get(JSON.stringify(run.font)));
            node.setRangeFontSize(run.start,run.end,run.fontSize);
            node.setRangeLineHeight(run.start,run.end,{unit:'PIXELS',value:run.lineHeight});
            node.setRangeLetterSpacing(run.start,run.end,{unit:'PIXELS',value:run.letterSpacing});
            node.setRangeFills(run.start,run.end,solid({...run.color,a:run.color.a*run.opacity}));
          }
          if(layer.runs)node.opacity=1;
          node.effects=(layer.shadows || []).map(shadow=>({type:'DROP_SHADOW',color:{...shadow.color,a:shadow.color.a*(layer.runs ? layer.opacity : 1)},offset:{x:shadow.x,y:shadow.y},radius:shadow.blur,visible:true,blendMode:'NORMAL'}));
          const error=Math.abs(node.width+layer.letterSpacing-layer.width);
          if(error>1){
            warnings.push(`${layer.name}: text width differs by ${error.toFixed(2)} px (${layer.text.slice(0,30)}).`);
            textDiagnostics.push({name:layer.name,text:layer.text,browserWidth:layer.width,figmaWidth:node.width,letterSpacing:layer.letterSpacing,widthError:error,fontSize:layer.fontSize,requestedFont:layer.font,resolvedFonts:node.getStyledTextSegments(['fontName','fontSize']).map(run=>({start:run.start,end:run.end,font:run.fontName,fontSize:run.fontSize})),browserLines:layer.measuredLines || []});
          }
        }else{
          node=track(figma.createRectangle());
          if(layer.type==='fade')node.fills=[{type:'GRADIENT_LINEAR',gradientTransform:[[0,1,0],[-1,0,1]],gradientStops:[{position:0,color:{r:0,g:0,b:0,a:0}},{position:(.62-.42)/.58,color:{r:0,g:0,b:0,a:.12}},{position:1,color:{r:0,g:0,b:0,a:.78}}]}];
          else {node.fills=solid(layer.color);node.cornerRadius=layer.radius||0;}
        }
        frame.appendChild(node);node.name=layer.name;if(layer.type!=='text')node.resize(layer.width,layer.height);node.x=layer.x;node.y=layer.y;
      }
    }
    figma.viewport.scrollAndZoomIntoView([root]);
    return {bannerId:root.id,createdNodeIds,warnings:[...new Set(warnings)],fontDiagnostics,textDiagnostics,status:warnings.length?'needs-review':'needs-visual-comparison'};
  }catch(error){root.remove();throw error;}
}

figma.showUI(__html__,{width:420,height:360});let nextImportPosition;let batchNodeIds=[];figma.ui.onmessage=async message=>{if(message.type!=='import')return;try{if(message.batchStart){nextImportPosition=undefined;batchNodeIds=[]}const result=await importBanner(figma,message.data,{},nextImportPosition);const node=await figma.getNodeByIdAsync(result.bannerId);batchNodeIds.push(node.id);nextImportPosition={x:node.x+node.width+80,y:node.y};if(message.batchEnd){const nodes=await Promise.all(batchNodeIds.map(id=>figma.getNodeByIdAsync(id)));figma.viewport.scrollAndZoomIntoView(nodes.filter(Boolean))}const png=Array.from(await node.exportAsync({format:'PNG',constraint:{type:'SCALE',value:1}}));figma.ui.postMessage({result,png})}catch(error){figma.ui.postMessage({error:error.message})}};
