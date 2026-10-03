import {AppError} from './errors.mjs';

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
