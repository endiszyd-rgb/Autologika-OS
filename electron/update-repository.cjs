const DEFAULT_UPDATE_REPOSITORY=Object.freeze({owner:'endiszyd-rgb',repo:'Autologika-OS'})

function resolveUpdateRepository(packageInfo={}){
  const publish=Array.isArray(packageInfo.build?.publish)?packageInfo.build.publish[0]:packageInfo.build?.publish
  return {
    owner:String(publish?.owner||DEFAULT_UPDATE_REPOSITORY.owner).trim(),
    repo:String(publish?.repo||DEFAULT_UPDATE_REPOSITORY.repo).trim()
  }
}

module.exports={DEFAULT_UPDATE_REPOSITORY,resolveUpdateRepository}
