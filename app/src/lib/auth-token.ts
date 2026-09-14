"use client"

// Mirrors the backend's ACCESS_TOKEN_EXPIRE_MINUTES (60 * 300) in seconds.
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 300

// Also mirrored into a cookie since server-side middleware can't read localStorage.
export function setAuthToken(token: string) {
  localStorage.setItem("token", token)

  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `token=${token}; Path=/; Max-Age=${TOKEN_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

export function clearAuthToken() {
  localStorage.removeItem("token")
  document.cookie = "token=; Path=/; Max-Age=0; SameSite=Lax"
}
