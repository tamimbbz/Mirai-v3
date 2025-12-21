"use strict";

var utils = require("../utils");
var log = require("npmlog");

/**
 * Sticker API Module
 * Provides access to Facebook's GraphQL-based sticker endpoints
 * Made by @ChoruOfficial - Ported to fca-updated format
 */

/**
 * Format the sticker pack list (store or tray)
 * @param {object} data - Raw GraphQL response
 * @returns {{ packs: Array<{id: string, name: string, thumbnail: string}>, page_info: object, store_id?: string }}
 */
function formatPackList(data) {
  var trayPacks = data?.data?.picker_plugins?.sticker_picker?.sticker_store?.tray_packs?.edges;
  var storePacks = data?.data?.viewer?.sticker_store?.available_packs?.edges;
  
  var packData = storePacks || trayPacks;
  if (!packData || !packData.edges) {
    return { packs: [], page_info: { has_next_page: false } };
  }

  var formattedPacks = packData.edges.map(function(edge) {
    if (!edge.node) return null;
    return {
      id: edge.node.id,
      name: edge.node.name,
      thumbnail: edge.node.thumbnail_image?.uri
    };
  }).filter(Boolean);

  return {
    packs: formattedPacks,
    page_info: packData.page_info,
    store_id: data?.data?.viewer?.sticker_store?.id
  };
}

/**
 * Format search result stickers
 * @param {object} data - Raw GraphQL response
 * @returns {Array<Object>}
 */
function formatStickerSearchResults(data) {
  var stickers = data?.data?.sticker_search?.sticker_results?.edges;
  if (!stickers) return [];
  
  return stickers.map(function(edge) {
    if (!edge.node) return null;
    return {
      type: "sticker",
      ID: edge.node.id,
      url: edge.node.image?.uri,
      animatedUrl: edge.node.animated_image?.uri,
      packID: edge.node.pack?.id,
      label: edge.node.label || edge.node.accessibility_label,
      stickerID: edge.node.id
    };
  }).filter(Boolean);
}

/**
 * Format sticker pack content
 * @param {object} data - Raw GraphQL response
 * @returns {Array<Object>}
 */
function formatStickerPackResults(data) {
  var stickers = data?.data?.sticker_pack?.stickers?.edges;
  if (!stickers) return [];
  
  return stickers.map(function(edge) {
    if (!edge.node) return null;
    return {
      type: "sticker",
      ID: edge.node.id,
      url: edge.node.image?.uri,
      animatedUrl: edge.node.animated_image?.uri,
      packID: edge.node.pack?.id,
      label: edge.node.label || edge.node.accessibility_label,
      stickerID: edge.node.id
    };
  }).filter(Boolean);
}

/**
 * Format AI-generated stickers
 * @param {object} data - Raw GraphQL response
 * @returns {Array<Object>}
 */
function formatAiStickers(data) {
  var stickers = data?.data?.xfb_trending_generated_ai_stickers?.nodes;
  if (!stickers) return [];
  
  return stickers.map(function(node) {
    return {
      type: "sticker",
      ID: node.id,
      url: node.url,
      label: node.label,
      stickerID: node.id
    };
  }).filter(Boolean);
}

module.exports = function(defaultFuncs, api, ctx) {
  /**
   * Make a GraphQL request and handle login and error checking
   * @param {object} form - Form data for the request
   * @returns {Promise<object>}
   */
  function makeRequest(form) {
    return defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function(resData) {
        if (!resData) {
          throw new Error("GraphQL request returned no data.");
        }
        if (resData.errors) {
          log.error("StickerAPI GraphQL Error", resData.errors[0].message);
          throw resData.errors[0];
        }
        return resData;
      });
  }

  return {
    /**
     * Search for stickers by keyword
     * @param {string} query - Search term
     * @param {function} callback - Optional callback(err, result)
     * @returns {Promise<Array<Object>>}
     */
    search: function(query, callback) {
      var resolveFunc = function() {};
      var rejectFunc = function() {};
      var returnPromise = new Promise(function(resolve, reject) {
        resolveFunc = resolve;
        rejectFunc = reject;
      });

      if (!callback) {
        callback = function(err, data) {
          if (err) return rejectFunc(err);
          resolveFunc(data);
        };
      }

      if (!query) {
        return callback({ error: "Search query is required." });
      }

      var form = {
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'CometStickerPickerSearchResultsRootQuery',
        variables: JSON.stringify({
          scale: 3,
          search_query: query,
          sticker_height: 128,
          sticker_width: 128,
          stickerInterface: "MESSAGES"
        }),
        doc_id: '24004987559125954'
      };

      makeRequest(form)
        .then(function(res) {
          var results = formatStickerSearchResults(res);
          log.info("stickers.search", "Found " + results.length + " stickers for query: " + query);
          callback(null, results);
        })
        .catch(function(err) {
          log.error("stickers.search", err);
          callback(err);
        });

      return returnPromise;
    },

    /**
     * List user's sticker packs
     * @param {function} callback - Optional callback(err, result)
     * @returns {Promise<Array<Object>>}
     */
    listPacks: function(callback) {
      var resolveFunc = function() {};
      var rejectFunc = function() {};
      var returnPromise = new Promise(function(resolve, reject) {
        resolveFunc = resolve;
        rejectFunc = reject;
      });

      if (!callback) {
        callback = function(err, data) {
          if (err) return rejectFunc(err);
          resolveFunc(data);
        };
      }

      var form = {
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'CometStickerPickerCardQuery',
        variables: JSON.stringify({ scale: 3, stickerInterface: "MESSAGES" }),
        doc_id: '10095807770482952'
      };

      makeRequest(form)
        .then(function(res) {
          var packs = formatPackList(res).packs;
          log.info("stickers.listPacks", "Found " + packs.length + " user sticker packs");
          callback(null, packs);
        })
        .catch(function(err) {
          log.error("stickers.listPacks", err);
          callback(err);
        });

      return returnPromise;
    },

    /**
     * Get all available sticker packs from the store (with pagination)
     * @param {function} callback - Optional callback(err, result)
     * @returns {Promise<Array<Object>>}
     */
    getStorePacks: function(callback) {
      var resolveFunc = function() {};
      var rejectFunc = function() {};
      var returnPromise = new Promise(function(resolve, reject) {
        resolveFunc = resolve;
        rejectFunc = reject;
      });

      if (!callback) {
        callback = function(err, data) {
          if (err) return rejectFunc(err);
          resolveFunc(data);
        };
      }

      log.info("stickers.getStorePacks", "Starting to fetch all sticker packs from store...");
      var allPacks = [];

      var initialForm = {
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'CometStickersStoreDialogQuery',
        variables: JSON.stringify({}),
        doc_id: '29237828849196584'
      };

      makeRequest(initialForm)
        .then(function(res) {
          var result = formatPackList(res);
          var packs = result.packs;
          var page_info = result.page_info;
          var store_id = result.store_id;
          
          allPacks = allPacks.concat(packs);
          log.info("stickers.getStorePacks", "Fetched first page with " + packs.length + " packs.");

          // Handle pagination
          function fetchNextPage() {
            if (!page_info || !page_info.has_next_page) {
              log.info("stickers.getStorePacks", "Finished fetching. Total unique packs found: " + allPacks.length);
              return callback(null, allPacks);
            }

            log.info("stickers.getStorePacks", "Fetching next page with cursor: " + page_info.end_cursor);

            var paginatedForm = {
              fb_api_caller_class: 'RelayModern',
              fb_api_req_friendly_name: 'CometStickersStorePackListPaginationQuery',
              variables: JSON.stringify({
                count: 20,
                cursor: page_info.end_cursor,
                id: store_id
              }),
              doc_id: '9898634630218439'
            };

            makeRequest(paginatedForm)
              .then(function(nextRes) {
                var paginatedResult = formatPackList(nextRes);
                allPacks = allPacks.concat(paginatedResult.packs);
                page_info = paginatedResult.page_info;
                log.info("stickers.getStorePacks", "Fetched " + paginatedResult.packs.length + " more packs. Total now: " + allPacks.length);
                fetchNextPage();
              })
              .catch(function(err) {
                log.error("stickers.getStorePacks", err);
                callback(err);
              });
          }

          fetchNextPage();
        })
        .catch(function(err) {
          log.error("stickers.getStorePacks", err);
          callback(err);
        });

      return returnPromise;
    },

    /**
     * Merge user's and store sticker packs into one list
     * @param {function} callback - Optional callback(err, result)
     * @returns {Promise<Array<Object>>}
     */
    listAllPacks: function(callback) {
      var resolveFunc = function() {};
      var rejectFunc = function() {};
      var returnPromise = new Promise(function(resolve, reject) {
        resolveFunc = resolve;
        rejectFunc = reject;
      });

      if (!callback) {
        callback = function(err, data) {
          if (err) return rejectFunc(err);
          resolveFunc(data);
        };
      }

      var self = this;
      
      Promise.all([
        new Promise(function(resolve, reject) {
          self.listPacks(function(err, data) {
            if (err) return reject(err);
            resolve(data);
          });
        }),
        new Promise(function(resolve, reject) {
          self.getStorePacks(function(err, data) {
            if (err) return reject(err);
            resolve(data);
          });
        })
      ])
      .then(function(results) {
        var myPacks = results[0];
        var storePacks = results[1];
        
        var allPacksMap = {};
        myPacks.forEach(function(pack) {
          allPacksMap[pack.id] = pack;
        });
        storePacks.forEach(function(pack) {
          allPacksMap[pack.id] = pack;
        });
        
        var allPacks = Object.keys(allPacksMap).map(function(key) {
          return allPacksMap[key];
        });
        
        log.info("stickers.listAllPacks", "Total unique packs: " + allPacks.length);
        callback(null, allPacks);
      })
      .catch(function(err) {
        log.error("stickers.listAllPacks", err);
        callback(err);
      });

      return returnPromise;
    },

    /**
     * Add a sticker pack by ID
     * @param {string} packID - The ID of the sticker pack
     * @param {function} callback - Optional callback(err, result)
     * @returns {Promise<Object>}
     */
    addPack: function(packID, callback) {
      var resolveFunc = function() {};
      var rejectFunc = function() {};
      var returnPromise = new Promise(function(resolve, reject) {
        resolveFunc = resolve;
        rejectFunc = reject;
      });

      if (!callback) {
        callback = function(err, data) {
          if (err) return rejectFunc(err);
          resolveFunc(data);
        };
      }

      if (!packID) {
        return callback({ error: "Pack ID is required." });
      }

      var form = {
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'CometStickersStorePackMutationAddMutation',
        variables: JSON.stringify({
          input: {
            pack_id: packID,
            actor_id: ctx.userID,
            client_mutation_id: Math.round(Math.random() * 10).toString()
          }
        }),
        doc_id: '9877489362345320'
      };

      makeRequest(form)
        .then(function(res) {
          var pack = res.data.sticker_pack_add.sticker_pack;
          log.info("stickers.addPack", "Successfully added sticker pack: " + packID);
          callback(null, pack);
        })
        .catch(function(err) {
          log.error("stickers.addPack", err);
          callback(err);
        });

      return returnPromise;
    },

    /**
     * Get all stickers in a pack
     * @param {string} packID - Sticker pack ID
     * @param {function} callback - Optional callback(err, result)
     * @returns {Promise<Array<Object>>}
     */
    getStickersInPack: function(packID, callback) {
      var resolveFunc = function() {};
      var rejectFunc = function() {};
      var returnPromise = new Promise(function(resolve, reject) {
        resolveFunc = resolve;
        rejectFunc = reject;
      });

      if (!callback) {
        callback = function(err, data) {
          if (err) return rejectFunc(err);
          resolveFunc(data);
        };
      }

      if (!packID) {
        return callback({ error: "Pack ID is required." });
      }

      var form = {
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'CometStickerPickerPackContentRootQuery',
        variables: JSON.stringify({ 
          packID: packID, 
          stickerWidth: 128, 
          stickerHeight: 128, 
          scale: 3 
        }),
        doc_id: '23982341384707469'
      };

      makeRequest(form)
        .then(function(res) {
          var stickers = formatStickerPackResults(res);
          log.info("stickers.getStickersInPack", "Found " + stickers.length + " stickers in pack: " + packID);
          callback(null, stickers);
        })
        .catch(function(err) {
          log.error("stickers.getStickersInPack", err);
          callback(err);
        });

      return returnPromise;
    },

    /**
     * Get trending AI-generated stickers
     * @param {Object} options - Options object { limit: number }
     * @param {function} callback - Optional callback(err, result)
     * @returns {Promise<Array<Object>>}
     */
    getAiStickers: function(options, callback) {
      var resolveFunc = function() {};
      var rejectFunc = function() {};
      var returnPromise = new Promise(function(resolve, reject) {
        resolveFunc = resolve;
        rejectFunc = reject;
      });

      // Handle optional parameters
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      
      options = options || {};
      var limit = options.limit || 10;

      if (!callback) {
        callback = function(err, data) {
          if (err) return rejectFunc(err);
          resolveFunc(data);
        };
      }

      var form = {
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'CometStickerPickerStickerGeneratedCardQuery',
        variables: JSON.stringify({ limit: limit }),
        doc_id: '24151467751156443'
      };

      makeRequest(form)
        .then(function(res) {
          var stickers = formatAiStickers(res);
          log.info("stickers.getAiStickers", "Found " + stickers.length + " AI stickers");
          callback(null, stickers);
        })
        .catch(function(err) {
          log.error("stickers.getAiStickers", err);
          callback(err);
        });

      return returnPromise;
    }
  };
};
