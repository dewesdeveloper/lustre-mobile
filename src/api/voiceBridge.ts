// Связка «звонок ↔ голосовой канал» без циклических импортов: LiveKit-комната в приложении
// одна, поэтому начало звонка выводит из голосового канала (как в лаунчере).

let leaveVoice: (() => void) | null = null;

export function registerVoiceLeave(fn: () => void) {
  leaveVoice = fn;
}

/** Вызывается перед подключением звонка */
export function leaveVoiceForCall() {
  leaveVoice?.();
}
