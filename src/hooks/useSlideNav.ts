import { createContext, useContext } from 'react'

export const NavContext = createContext<(index: number) => void>(() => {})

export function useSlideNav() {
  return useContext(NavContext)
}
