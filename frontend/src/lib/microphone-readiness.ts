'use client';

let verified = false;
export const microphoneGuidance = '마이크를 허용해야 상담 대기로 전환할 수 있습니다. 차단한 경우 주소창의 사이트 설정에서 마이크를 허용한 뒤 대기를 다시 선택해 주세요.';

/** Called from the availability gesture; the probe is never published or recorded. */
export async function prepareMicrophone(): Promise<void> {
  verified = false;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('마이크를 사용할 수 없습니다. HTTPS 주소와 브라우저의 마이크 지원을 확인해 주세요.');
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const capture = navigator.mediaDevices.getUserMedia({audio:true}).then(stream => {
    const usable = stream.getAudioTracks().some(track => track.readyState === 'live');
    stream.getTracks().forEach(track => track.stop());
    if (expired || !usable) throw new Error('마이크 확인을 완료하지 못했습니다. 대기를 다시 선택해 주세요.');
  });
  try {
    await Promise.race([capture, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new Error('마이크 허용을 기다리다 중단했습니다. 대기를 다시 선택해 주세요.')); }, 20000);
    })]);
    verified = true;
  } catch (error) {
    if ((error as Error).name === 'NotAllowedError') throw new Error(microphoneGuidance);
    if (['NotFoundError','NotReadableError'].includes((error as Error).name)) throw new Error('마이크를 사용할 수 없습니다. 장치 연결과 다른 앱의 마이크 사용을 확인해 주세요.');
    throw error;
  } finally { clearTimeout(timer); }
}

/** Polling must never open an unsolicited permission prompt. Reload requires explicit readiness. */
export async function microphoneReady(): Promise<boolean> {
  if (!verified) return false;
  try {
    const permission = await navigator.permissions.query({name:'microphone' as PermissionName});
    if (permission.state !== 'granted') { verified = false; return false; }
  } catch { /* Some supported browsers do not expose microphone Permissions API. */ }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (!devices.some(device => device.kind === 'audioinput')) verified = false;
  } catch { verified = false; }
  return verified;
}
