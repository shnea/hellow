import {beforeEach,expect,it,vi} from 'vitest';
import {rememberSupportResume,loadSupportResume,clearSupportResume} from './support-session';
beforeEach(()=>{localStorage.clear();sessionStorage.clear();vi.restoreAllMocks();});
it('restores only the same organization within thirty seconds, without persisting contact details',()=>{
 vi.spyOn(Date,'now').mockReturnValue(1000);rememberSupportResume('a','session-capability');
 expect(loadSupportResume('b')).toBeNull();expect(loadSupportResume('a')).toBe('session-capability');expect(localStorage.length).toBe(0);
 expect(loadSupportResume('a')).toBe('session-capability');clearSupportResume('a');expect(loadSupportResume('a')).toBeNull();
 rememberSupportResume('a','session-capability');vi.spyOn(Date,'now').mockReturnValue(31000);expect(loadSupportResume('a')).toBeNull();expect(localStorage.length).toBe(0);
});
