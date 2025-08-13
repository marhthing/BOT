/**
 * Message Cache Feature Event Handlers
 */

module.exports = {
    'messages.upsert': async (messageUpdate, feature) => {
        try {
            await feature.handleMessage(messageUpdate);
        } catch (error) {
            feature.logger?.error('❌ Error in messages.upsert handler:', error);
        }
    },

    'messages.update': async (messageUpdate, feature) => {
        try {
            await feature.handleMessageUpdate(messageUpdate);
        } catch (error) {
            feature.logger?.error('❌ Error in messages.update handler:', error);
        }
    },

    'messages.delete': async (deleteInfo, feature) => {
        try {
            await feature.handleMessageDelete(deleteInfo);
        } catch (error) {
            feature.logger?.error('❌ Error in messages.delete handler:', error);
        }
    },

    'connection.update': async (update, feature) => {
        try {
            const { connection } = update;
            
            if (connection === 'open') {
                feature.logger?.info('🔗 Connection established, message caching active');
            } else if (connection === 'close') {
                feature.logger?.info('🔌 Connection closed, saving cache data');
                await feature.saveCacheData();
            }
            
        } catch (error) {
            feature.logger?.error('❌ Error in connection.update handler:', error);
        }
    },

    'cache.cleanup': async (data, feature) => {
        try {
            // Handle manual cleanup requests
            await feature.cleanupOldMessages();
            feature.logger?.info('🧹 Manual cache cleanup completed');
        } catch (error) {
            feature.logger?.error('❌ Error in cache.cleanup handler:', error);
        }
    },

    'cache.clear': async (data, feature) => {
        try {
            // Handle cache clear requests
            const { chatId } = data || {};
            await feature.clearCache(chatId);
            feature.logger?.info(`🗑️ Cache cleared${chatId ? ` for chat: ${chatId}` : ' (all chats)'}`);
        } catch (error) {
            feature.logger?.error('❌ Error in cache.clear handler:', error);
        }
    }
};
