"use client"


const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 300


export function setAuthToken(token: string) {
  localStorage.setItem("token", token)

  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `token=${token}; Path=/; Max-Age=${TOKEN_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

export function clearAuthToken() {
  localStorage.removeItem("token")
  document.cookie = "token=; Path=/; Max-Age=0; SameSite=Lax"
}
