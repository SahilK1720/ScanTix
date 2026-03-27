import React from 'react';
import './ShinyText.css';

/**
 * ShinyText
 * Creates a sweeping metallic shine effect across text.
 * 
 * Props:
 *  - text {string} - The main text to display
 *  - disabled {boolean} - To disable the animation
 *  - speed {number} - Animation speed in seconds. Default: 5
 *  - delay {number} - Animation delay in seconds. Default: 0
 *  - color {string} - The base text color (often semi-transparent). Default: 'rgba(255, 255, 255, 0.7)'
 *  - shineColor {string} - The highlight color. Default: '#ffffff'
 *  - spread {number} - How spread out the shine is. Default: 2.5
 *  - direction {'normal' | 'reverse'} - Which way the shine sweeps. Default: 'normal'
 *  - yoyo {boolean} - If true, animation runs forwards then backwards. Default: false
 *  - pauseOnHover {boolean} - If true, pausing the animation on hover. Default: true
 *  - className {string} - Optional CSS classes
 */
const ShinyText = ({
  text = '',
  disabled = false,
  speed = 5,
  delay = 0,
  color = 'rgba(255, 255, 255, 0.7)',
  shineColor = '#ffffff',
  spread = 2.5,
  direction = 'normal',
  yoyo = false,
  pauseOnHover = true,
  className = '',
}) => {
  const animationDuration = `${speed}s`;
  const animationDelay = `${delay}s`;
  const animationIteration = yoyo ? 'infinite alternate' : 'infinite';

  return (
    <span
      className={`shiny-text ${disabled ? 'disabled' : ''} ${pauseOnHover ? 'pause-on-hover' : ''} ${className}`}
      style={{
        '--shiny-speed': animationDuration,
        '--shiny-delay': animationDelay,
        '--shiny-base-color': color,
        '--shiny-highlight-color': shineColor,
        '--shiny-spread': spread,
        '--shiny-direction': direction,
        '--shiny-iteration': animationIteration,
      }}
    >
      {text}
    </span>
  );
};

export default ShinyText;
