export const STUDY_MOD = 'study-room'

export interface StudyEligibility {contact:boolean;blocked:boolean;tier:string;unavailable:boolean;resting:boolean;committed:boolean;declined:boolean}
export function studyEligibility(p:StudyEligibility):string {
 if(!p.contact)return 'Not a contact'
 if(p.blocked)return 'Unavailable'
 if(!['friendly','trusted','devoted'].includes(p.tier))return 'Become friends first'
 if(p.declined)return 'She has ended this session for this time slot'
 if(p.unavailable||p.resting||p.committed)return 'Busy this time slot'
 return ''
}
