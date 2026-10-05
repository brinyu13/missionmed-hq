import {AppError} from './errors.mjs';
import {createRiseOwner} from './rise-owner.mjs';

export function createOwnerServices(config={},dependencies={}){
  const rise=createRiseOwner(config.rise,dependencies);
  return {...unavailableOwners(),...rise,rise:Object.freeze({savedPrograms:async(actor,query)=>{if(typeof rise.listSavedPrograms!=='function')throw new AppError(503,'owner_service_unavailable','Saved Programs is temporarily unavailable.');return rise.listSavedPrograms(actor,query);}})};
}

// Production composition replaces each unavailable seam only with its registered
// owner adapter. These failures preserve manual interview and private draft work;
// they never synthesize program evidence, practice results or publication.
export function unavailableOwners() {
  const unavailable=async()=>{throw new AppError(503,'owner_service_unavailable','This connected service is unavailable. Your saved interview remains safe.');};
  return {
    ivocAvailable:false,getProgram:unavailable,searchPrograms:unavailable,storyConsent:unavailable,
    startPractice:unavailable,practiceFeedback:unavailable,launchIVOC:unavailable,receiveIVOC:unavailable,
    async validateBasis(actor,row,basis) {
      if(!basis.fact && !basis.story)return {};
      return unavailable();
    },
    async context() {return {programs:[],facts:[],sources:[],stories:[],status:{rise:'unavailable',storyforge:'unavailable'}};},
  };
}
