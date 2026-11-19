const DB = 'roomlab-local';
let connection;
const writtenAssets = new Map();
function database() {
  if (!connection) connection = new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,2);
    request.onupgradeneeded=()=>{
      for (const name of ['projects','assets']) if(!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess=()=>{
      const db=request.result;
      db.onversionchange=()=>{db.close();connection=null;writtenAssets.clear();};
      resolve(db);
    };
    request.onerror=()=>{connection=null;reject(request.error);};
  });
  return connection;
}
export async function saveLocal(project) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['projects','assets'],'readwrite');
    const changed=[];
    for(const asset of project.assets || []){
      if(writtenAssets.get(asset.id)!==asset.data){tx.objectStore('assets').put(asset,asset.id);changed.push(asset);}
    }
    const lightweight={...project,assets:(project.assets || []).map(({id,name})=>({id,name}))};
    tx.objectStore('projects').put({project:lightweight,assetStoreVersion:2,savedAt:Date.now()},'current');
    tx.oncomplete=()=>{changed.forEach(a=>writtenAssets.set(a.id,a.data));resolve();};
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error || new Error('本地保存被中断'));
  });
}
export async function readLocal() {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['projects','assets']);
    const request=tx.objectStore('projects').get('current');
    let record, assets=[], missing=false;
    request.onsuccess=()=>{
      record=request.result;
      if(record?.assetStoreVersion!==2)return;
      const refs=record.project.assets || [];assets=new Array(refs.length);
      refs.forEach((ref,i)=>{
        const resource=tx.objectStore('assets').get(ref.id);
        resource.onsuccess=()=>{assets[i]=resource.result;if(!assets[i])missing=true;};
      });
    };
    tx.oncomplete=()=>{
      if(missing){reject(new Error('本地方案缺少家具资源'));return;}
      if(record?.assetStoreVersion===2){
        record={...record,project:{...record.project,assets}};
        assets.forEach(a=>writtenAssets.set(a.id,a.data));
      }
      resolve(record);
    };
    tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
// Keep only the latest pending state. A slow write must never replace a newer edit.
export function createAutosaver({onStatus=()=>{},onError=()=>{},write=saveLocal}={}) {
  let pending=null,writing=null,closed=false,errorNotified=false;
  const status=value=>{if(!closed)onStatus(value);};
  async function drain(){
    while(pending){
      const project=pending;pending=null;
      try{await write(project);errorNotified=false;}
      catch(error){
        pending=pending || project;status('error');
        if(!closed&&!errorNotified){errorNotified=true;onError(error);}
        return;
      }
    }
    status('saved');
  }
  const flush=()=>{
    if(!writing&&pending){status('saving');writing=drain().finally(()=>{writing=null;});}
    return writing || Promise.resolve();
  };
  return {
    enqueue(project){if(closed)return;pending=project;status('saving');void flush();},
    flush,
    close(){void flush();closed=true;},
  };
}
