import { asset } from '../lib/asset'

export const PREP_MODES = [
  {
    id: 'teapot',
    title: 'Total transformation',
    body: 'Citrine teapot — geological material fully remade.',
    src: asset('images/prep-teapot.jpg'),
    alt: 'Citrine teapot',
    objectPosition: '50% 66%',
  },
  {
    id: 'chrysanthemum',
    title: 'Subtraction',
    body: 'Chrysanthemum stone — revealing rather than reshaping.',
    src: asset('images/prep-chrysanthemum.jpg'),
    alt: 'Celestine chrysanthemum stone',
  },
  {
    id: 'malachite',
    title: 'Architecture exposed',
    body: 'Malachite ‘feet’ in azurite — cut and polished.',
    src: asset('images/prep-malachite.jpg'),
    alt: 'Malachite feet in azurite, cut and polished',
  },
  {
    id: 'ammolite',
    title: 'Interpretive reconstruction',
    body: 'Ammolite with Pepper’s Ghost — meaning added in light.',
    src: asset('images/prep-ammolite.jpg'),
    alt: 'Ammolite ammonite in swimming position',
    video: asset('images/prep-ammolite.mp4'),
    poster: asset('images/prep-ammolite-poster.jpg'),
  },
]
