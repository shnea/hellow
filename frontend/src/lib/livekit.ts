'use client';

import { Room, RoomEvent, Track, ConnectionState, Participant, DisconnectReason, createLocalAudioTrack, type LocalAudioTrack } from 'livekit-client';

export interface LiveKitCallbacks {
  onConnected?: (room: Room) => void;
  onDisconnected?: () => void;
  onRemoteAudioAttached?: (element: HTMLAudioElement) => void;
  onAudioPlaybackChanged?: (allowed: boolean) => void;
  onConnectionStateChanged?: (state: ConnectionState) => void;
  onSpeakingChanged?: (speaking: boolean, participant: Participant) => void;
  onError?: (err: Error) => void;
}

export class LiveKitCallSession {
  private room: Room | null = null;
  private audioElements = new Map<Track,HTMLAudioElement>();
  private callbacks: LiveKitCallbacks;
  private disposed = false;
  private microphone: LocalAudioTrack | null = null;

  constructor(callbacks: LiveKitCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * 브라우저 호스트 및 Nginx 리버스 프록시(/livekit/) 고려한 WebSocket URL 계산
   */
  public static resolveWsUrl(serverUrl?: string): string {
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const wsProto = isHttps ? 'wss:' : 'ws:';
      // 현재 브라우저의 호스트(예: localhost:30160 또는 dev-hellow.shnea.kr:30160)
      // 이 프록시는 시그널링용이다. 실제 오디오는 별도의 ICE/TURN 도달성이 필요하다.
      return `${wsProto}//${window.location.host}/livekit/`;
    }
    return serverUrl || 'ws://localhost:30162';
  }

  public async connect(url: string, token: string, muted = false): Promise<Room> {
    // 이전 연결 정리
    if (this.disposed) throw new Error('종료된 통화 연결입니다.');

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      // Keep one playback context while a handoff replaces remote agent tracks.
      webAudioMix: true,
    });
    this.room = room;

    // 이벤트 리스너 등록
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      this.callbacks.onConnectionStateChanged?.(state);
    });

    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (!this.disposed) this.callbacks.onAudioPlaybackChanged?.(room.canPlaybackAudio);
    });
    room.on(RoomEvent.Reconnected, () => {
      if (!this.disposed) this.callbacks.onConnected?.(room);
    });

    room.on(RoomEvent.Disconnected, (reason) => {
      this.cleanupAudio();
      if(this.disposed)return;
      this.callbacks.onDisconnected?.();
      this.callbacks.onError?.(new Error(reason===DisconnectReason.DUPLICATE_IDENTITY
        ? '다른 브라우저에서 같은 계정으로 통화에 연결하여 음성 연결이 종료됐습니다.'
        : '음성 서버 연결이 끊겼습니다. 상담 내용은 유지됩니다.'));
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        // 상대방 오디오 엘리먼트 생성 및 자동 재생
        const el = track.attach();
        el.id = `livekit-audio-${participant.identity}`;
        el.autoplay = true;
        document.body.appendChild(el);
        this.audioElements.set(track,el);
        this.callbacks.onRemoteAudioAttached?.(el);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
      this.cleanupAudio(track);
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      if (room.localParticipant) {
        const isSpeaking = speakers.some((s) => s.identity === room.localParticipant.identity);
        this.callbacks.onSpeakingChanged?.(isSpeaking, room.localParticipant);
      }
    });

    try {
      // Acquire permission before ICE gathering. Chromium may hide local addresses until
      // capture is permitted; requesting the microphone after ICE can leave a new PC stuck.
      const microphone=await createLocalAudioTrack();
      if(this.disposed){microphone.stop();throw new Error('통화 연결이 취소되었습니다.');}
      this.microphone=microphone;
      if(muted)await microphone.mute();
      // 1. Nginx 프록시 WebSocket URL 시도
      const wsUrl = LiveKitCallSession.resolveWsUrl(url);
      try {
        await room.connect(wsUrl, token);
      } catch (proxyErr) {
        if(this.disposed) throw proxyErr;
        console.warn('음성 시그널링 프록시 연결 실패. 대체 서버 연결을 시도합니다.');
        // fallback: 백엔드가 내려준 direct url (예: ws://localhost:30162)
        await room.connect(url, token);
      }

      // 2. 마이크 활성화 및 로컬 오디오 스트림 송출
      if(this.disposed) { await room.disconnect(); throw new Error('통화 연결이 취소되었습니다.'); }
      await room.localParticipant.publishTrack(microphone,{source:Track.Source.Microphone});
      if(this.disposed) { await room.disconnect(); throw new Error('통화 연결이 취소되었습니다.'); }
      this.callbacks.onConnected?.(room);
      this.callbacks.onAudioPlaybackChanged?.(room.canPlaybackAudio);

      return room;
    } catch (err) {
      const cause = err as Error;
      const message = cause.name === 'NotAllowedError'
        ? '마이크 사용이 허용되지 않았습니다. 브라우저의 마이크 권한을 확인한 뒤 다시 연결해 주세요.'
        : cause.name === 'NotFoundError' || cause.name === 'NotReadableError'
          ? '마이크를 사용할 수 없습니다. 연결 상태와 다른 앱의 마이크 사용을 확인한 뒤 다시 연결해 주세요.'
          : '음성 연결을 완료하지 못했습니다. 네트워크를 확인한 뒤 다시 연결해 주세요. 상담 내용은 유지됩니다.';
      const connectionError = new Error(message, { cause: err });
      this.callbacks.onError?.(connectionError);
      this.disconnect();
      throw connectionError;
    }
  }

  public async setMuted(muted: boolean): Promise<void> {
    if (this.room?.localParticipant) {
      await this.room.localParticipant.setMicrophoneEnabled(!muted);
    }
  }

  /** Must be called directly from a click/tap when the browser blocks autoplay. */
  public async startAudio(): Promise<void> {
    if (!this.room || this.disposed) throw new Error('음성 연결을 먼저 확인해 주세요.');
    await this.room.startAudio();
    this.callbacks.onAudioPlaybackChanged?.(this.room.canPlaybackAudio);
    if (!this.room.canPlaybackAudio) throw new Error('소리 재생이 차단되어 있습니다. 다시 눌러 주세요.');
  }

  public disconnect(): void {
    this.disposed = true;
    this.microphone?.stop();
    this.microphone=null;
    if (this.room) {
      try {
        this.room.disconnect();
      } catch (e) {
        console.error('Error disconnecting LiveKit room:', e);
      }
      this.room = null;
    }
    this.cleanupAudio();
  }

  private cleanupAudio(track?:Track): void {
    const elements=track?[...this.audioElements].filter(([key])=>key===track):[...this.audioElements];
    for (const [key,element] of elements) {
      try {
        key.detach();
        element.pause();
        element.srcObject = null;
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      } catch (e) {
        console.error('Error cleaning up audio element:', e);
      }
      this.audioElements.delete(key);
    }
  }

  public isConnected(): boolean {
    return this.room?.state === ConnectionState.Connected;
  }

  public getRoom(): Room | null {
    return this.room;
  }
}
