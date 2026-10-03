'use client';

import { Room, RoomEvent, Track, ConnectionState, Participant, DisconnectReason } from 'livekit-client';

export interface LiveKitCallbacks {
  onConnected?: (room: Room) => void;
  onDisconnected?: () => void;
  onRemoteAudioAttached?: (element: HTMLAudioElement) => void;
  onConnectionStateChanged?: (state: ConnectionState) => void;
  onSpeakingChanged?: (speaking: boolean, participant: Participant) => void;
  onError?: (err: Error) => void;
}

export class LiveKitCallSession {
  private room: Room | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private callbacks: LiveKitCallbacks;
  private disposed = false;

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
      // Nginx의 /livekit/ 프록시를 통해 직접 포트 오픈 없이 30160 단일 포트로 통신 가능
      return `${wsProto}//${window.location.host}/livekit/`;
    }
    return serverUrl || 'ws://localhost:30162';
  }

  public async connect(url: string, token: string): Promise<Room> {
    // 이전 연결 정리
    if (this.disposed) throw new Error('종료된 통화 연결입니다.');

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    this.room = room;

    // 이벤트 리스너 등록
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      this.callbacks.onConnectionStateChanged?.(state);
    });

    room.on(RoomEvent.Connected, () => {
      this.callbacks.onConnected?.(room);
    });

    room.on(RoomEvent.Disconnected, (reason) => {
      this.callbacks.onDisconnected?.();
      this.cleanupAudio();
      if(!this.disposed) this.callbacks.onError?.(new Error(reason===DisconnectReason.DUPLICATE_IDENTITY
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
        this.audioElement = el;
        this.callbacks.onRemoteAudioAttached?.(el);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
      this.cleanupAudio();
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      if (room.localParticipant) {
        const isSpeaking = speakers.some((s) => s.identity === room.localParticipant.identity);
        this.callbacks.onSpeakingChanged?.(isSpeaking, room.localParticipant);
      }
    });

    try {
      // 1. Nginx 프록시 WebSocket URL 시도
      const wsUrl = LiveKitCallSession.resolveWsUrl(url);
      try {
        await room.connect(wsUrl, token);
      } catch (proxyErr) {
        if(this.disposed) throw proxyErr;
        console.warn('LiveKit proxy connect failed, trying direct server url:', url, proxyErr);
        // fallback: 백엔드가 내려준 direct url (예: ws://localhost:30162)
        await room.connect(url, token);
      }

      // 2. 마이크 활성화 및 로컬 오디오 스트림 송출
      if(this.disposed) { await room.disconnect(); throw new Error('통화 연결이 취소되었습니다.'); }
      await room.localParticipant.setMicrophoneEnabled(true);
      if(this.disposed) { await room.disconnect(); throw new Error('통화 연결이 취소되었습니다.'); }

      return room;
    } catch (err) {
      this.callbacks.onError?.(err as Error);
      this.disconnect();
      throw err;
    }
  }

  public async setMuted(muted: boolean): Promise<void> {
    if (this.room?.localParticipant) {
      await this.room.localParticipant.setMicrophoneEnabled(!muted);
    }
  }

  public disconnect(): void {
    this.disposed = true;
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

  private cleanupAudio(): void {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.srcObject = null;
        if (this.audioElement.parentNode) {
          this.audioElement.parentNode.removeChild(this.audioElement);
        }
      } catch (e) {
        console.error('Error cleaning up audio element:', e);
      }
      this.audioElement = null;
    }
  }

  public isConnected(): boolean {
    return this.room?.state === ConnectionState.Connected;
  }

  public getRoom(): Room | null {
    return this.room;
  }
}
