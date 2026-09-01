"use client"

const API_URL = process.env.NEXT_PUBLIC_API_URL

const updateTitleTimers: Record<string, ReturnType<typeof setTimeout>> = {}

export function updateTitle(doc_id: string, newTitle: string) {
    const token = localStorage.getItem("token")
    if (!token) return

    if (updateTitleTimers[doc_id]) {
        clearTimeout(updateTitleTimers[doc_id])
    }

    updateTitleTimers[doc_id] = setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}/update-doc`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    doc_id: Number(doc_id),
                    title: newTitle,
                }),
            })

            if (!res.ok) {
                const err = await res.json()
                console.error("Failed to update title:", err)
                return
            }

            const data = await res.json()
        } catch (err) {
            console.error(err)
        }
    }, 500) // 0.5 sec debounce
}