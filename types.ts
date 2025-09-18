export type Place = { name: string; lat: number; lng: number; address?: string }
export type Activity = { id: string; text: string; start?: string; end?: string; place?: Place }
export type Day = { id: string; title: string; activities: Activity[] }
