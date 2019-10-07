// This is your Spotify credentials.
// Grab this from: https://developer.spotify.com/dashboard
//
const credentials = {
  clientId: "116d31f87cef47aab5328ec29ecedab3",
  redirectUri: "https://capitolroyale2.glitch.me", // or window.location.origin
  scopes: ["streaming", "user-read-birthdate", "user-read-email", "user-read-private"]
};

// Let's define a bunch of helper functions
//
const helpers = {};

helpers.getSpotifyAuthorizationUrl = ({ clientId, redirectUri, scopes }) => [
  `https://accounts.spotify.com/authorize?`,
  `response_type=token&`,
  `client_id=${clientId}&`,
  `scope=${scopes.join(' ')}&`,
  `redirect_uri=${encodeURIComponent(redirectUri)}`
].join('');

helpers.windowHashAsObject = () => window.location.hash.substring(1).split('&').reduce((params, param) => {
  const [key, value] = param.split('=');
  return { ... params, [key]: value };
}, {});

// Let's define our app
//
class App {
  constructor({ accessToken }) {
    this.accessToken = accessToken;
    this.player = new window.Spotify.Player({
      name: 'Hello, Capitol360!',
      getOAuthToken: callback => callback(accessToken),
      volume: 1.0
    });
    this.playerReady = false;
    this.playerDeviceId = null;
    
    this.player.addListener('ready', ({ device_id }) => {
      this.playerReady = true;
      this.playerDeviceId = device_id;
    });
    
    this.player.addListener('not_ready', () => {
      this.playerReady = false;
      this.playerDeviceId = null;
    });
    
    this.player.on('initialization_error', error => {
      console.error('Failed to initialize', error.message);
    });
    
    this.player.on('authentication_error', error => {
      console.error('Failed to authenticate', error.message);
    });
    
    this.player.on('account_error', error => {
      console.error('Failed to validate Spotify account', error.message);
    });
    
    this.player.on('playback_error', error => {
      console.error('Failed to perform playback', error.message);
    });
    
    this.player.connect();
    this.transferPlayback();
  }
                            
  async state() {
    return await this.player.getCurrentState();
  }
  
  async transferPlayback() {
    if (!this.playerReady) {
      console.error('Device is not ready for playback.');
      return;
    }    
    
    return await fetch(`https://api.spotify.com/v1/me/player`, {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [this.playerDeviceId], play: true }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
    });
  }
  
  async play({ trackUri, positionMs = 0 }) {
    if (!this.playerReady) {
      console.error('Device is not ready for playback.');
      return;
    }
    
    return await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.playerDeviceId}`, {
      method: 'PUT',
      body: JSON.stringify({ uris: [trackUri], position_ms: positionMs }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
    });
  }
  
  async getAudioFeaturesForCurrentTrack() {
    if (!this.playerReady) {
      console.error('Device is not ready for playback.');
      return;
    }

    const playerState = await this.player.getCurrentState();
    const trackId = playerState.track_window.current_track.id;
    
    const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
    });
    
    return await response.json();
  }
}

// Let's wrap everything together
//
document.addEventListener('DOMContentLoaded', () => {
  const { access_token: accessToken } = helpers.windowHashAsObject();
  
  if (window.location.protocol !== 'https:' || window.location.host === 'localhost') {
    console.error('This app needs to be loaded on either HTTPS or must be on a localhost.');
    return;
  }
  
  if (accessToken) {
    window.onSpotifyWebPlaybackSDKReady = () => {
      const app = new App({ accessToken });
      
      // TODO: Try changing the audio feature to valence or liveness.
      //       See https://developer.spotify.com/documentation/web-api/reference-beta/#endpoint-get-audio-features
      //
      // TODO: When you pause, using the Recommendations API, play the next track.
      //       You'll need the playerState.paused to check if it is paused.
      //       See https://developer.spotify.com/documentation/web-api/reference-beta/#endpoint-get-recommendations
      
      app.player.addListener('player_state_changed', async playerState => {
        const trackName = playerState.track_window.current_track.name;
        
        // Log player state
        console.log('Updated player state', { playerState });
        
        // Get danceability of current track
        const { danceability } = await app.getAudioFeaturesForCurrentTrack();
        
        // Update player name
        app.player.setName(`Hello, Capitol360! ${trackName} is ${Math.round(danceability * 100)}% danceability.`);
      });
      
      app.player.addListener('ready', () => {
        app.play({ trackUri: "spotify:track:3wPPWcVuinAU7dXcJXtCID" }); 
      });
      
      // Mount our application to the window
      window.app = app;
    };
  } else {
    // Redirect user to authenticate with Spotify
    const authorizationUrl = helpers.getSpotifyAuthorizationUrl(credentials);
    window.location.replace(authorizationUrl);
    
    // Don't load the Spotify Web Playback SDK
    window.onSpotifyWebPlaybackSDKReady = () => {};
  }
});
