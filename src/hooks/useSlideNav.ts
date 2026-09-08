import { createContext, useContext } from 'react'

export type GoToSlide = (index: number, behavior?: ScrollBehavior, force?: boolean) => void

export const NavContext = createContext<GoToSlide>(() => {})

export function useSlideNav() {
  return useContext(NavContext)
}
