/**
 * Texnoo Auth Client JS SDK v1.0 (OWASP Compliant OAuth 2.0 Client)
 * https://texnoo.com
 */
(function (window) {
  'use strict';

  var TexnooAuth = {
    serverUrl: 'https://texnoo.com',

    /**
     * Start OAuth Login Popup or Redirect Flow
     * @param {Object} options
     * @param {string} options.clientId - Generated Texnoo Client ID
     * @param {string} options.redirectUri - Whitelisted Callback URL
     * @param {string} [options.state] - CSRF Protection state string
     * @param {boolean} [options.popup=true] - Open login in popup or redirect
     * @param {Function} [options.onSuccess] - Callback when user data is retrieved (popup mode)
     * @param {Function} [options.onError] - Callback on error
     */
    login: function (options) {
      if (!options || !options.clientId || !options.redirectUri) {
        console.error('[TexnooAuth] clientId va redirectUri kiritilishi shart.');
        if (options && options.onError) options.onError('Missing parameters');
        return;
      }

      var state = options.state || Math.random().toString(36).substring(2);
      var authUrl = (this.serverUrl || window.location.origin) + '/oauth/authorize?' +
        'client_id=' + encodeURIComponent(options.clientId) +
        '&redirect_uri=' + encodeURIComponent(options.redirectUri) +
        '&response_type=code' +
        '&state=' + encodeURIComponent(state);

      if (options.popup !== false) {
        var width = 500;
        var height = 650;
        var left = (window.screen.width / 2) - (width / 2);
        var top = (window.screen.height / 2) - (height / 2);

        var popup = window.open(
          authUrl,
          'TexnooAuthLogin',
          'width=' + width + ',height=' + height + ',top=' + top + ',left=' + left + ',scrollbars=yes,status=yes'
        );

        if (!popup) {
          console.warn('[TexnooAuth] Popup bloklandi. Direct redirectga o\'tilmoqda.');
          window.location.href = authUrl;
          return;
        }

        var messageHandler = function (event) {
          if (event.data && event.data.type === 'TEXNOO_AUTH_SUCCESS') {
            window.removeEventListener('message', messageHandler);
            if (options.onSuccess) options.onSuccess(event.data.user);
          } else if (event.data && event.data.type === 'TEXNOO_AUTH_ERROR') {
            window.removeEventListener('message', messageHandler);
            if (options.onError) options.onError(event.data.error);
          }
        };
        window.addEventListener('message', messageHandler);
      } else {
        window.location.href = authUrl;
      }
    },

    /**
     * Exchange Code for Access Token and User Info from Whitelisted Callback Page
     * @param {Object} opts
     * @param {string} opts.clientId
     * @param {string} [opts.clientSecret]
     * @param {string} opts.code
     * @param {string} opts.redirectUri
     * @returns {Promise<Object>} User profile object { id, name, email, avatar, type }
     */
    getUserInfo: async function (opts) {
      if (!opts || !opts.clientId || !opts.code || !opts.redirectUri) {
        throw new Error('clientId, code, va redirectUri talab qilinadi.');
      }

      var server = this.serverUrl || window.location.origin;

      var tokenRes = await fetch(server + '/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: opts.clientId,
          client_secret: opts.clientSecret || '',
          code: opts.code,
          redirect_uri: opts.redirectUri
        })
      });

      var tokenData = await tokenRes.json();
      if (!tokenData.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || 'Token olishda xatolik yuz berdi.');
      }

      var userRes = await fetch(server + '/oauth/userinfo', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + tokenData.access_token
        }
      });

      var userData = await userRes.json();
      if (!userData.ok || !userData.user) {
        throw new Error(userData.error_description || 'Foydalanuvchi ma\'lumotlarini olishda xatolik.');
      }

      return userData.user;
    }
  };

  window.TexnooAuth = TexnooAuth;
})(window);
