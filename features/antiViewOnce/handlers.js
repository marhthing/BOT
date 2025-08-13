/**
 * Anti-ViewOnce Feature Event Handlers
 */

module.exports = {
    'messages.upsert': async (messageUpdate, feature) => {
        try {
            await feature.handleMessage(messageUpdate);
        } catch (error) {
            feature.logger?.error('❌ Error in messages.upsert handler:', error);
        }
    },

    'connection.update': async (update, feature) => {
        try {
            const { connection } = update;
            
            if (connection === 'open') {
                feature.logger?.info('🔗 Connection established, anti-viewonce monitoring active');
            } else if (connection === 'close') {
                feature.logger?.info('🔌 Connection closed, saving anti-viewonce data');
                await feature.saveViewOnceData();
            }
            
        } catch (error) {
            feature.logger?.error('❌ Error in connection.update handler:', error);
        }
    },

    'viewonce.captured': async (data, feature) => {
        try {
            // Handle captured viewonce content
            const { to, captureInfo, message } = data;
            
            // This would be handled by the message utils or bot manager
            feature.logger?.debug('👁️ ViewOnce captured notification:', {
                to: to,
                mediaType: captureInfo.mediaType,
                filename: captureInfo.filename
            });
            
            // Send notification if enabled
            const settings = feature.getSetting('settings', {});
            if (settings.notifyCapture) {
                // Send notification to target
                await feature.emit('message.send', {
                    to: to,
                    message: message
                });
            }
            
        } catch (error) {
            feature.logger?.error('❌ Error in viewonce.captured handler:', error);
        }
    },

    'media.download': async (data, feature) => {
        try {
            // Handle media download events
            const { message, mediaType } = data;
            
            feature.logger?.debug('📥 Media download event:', {
                messageId: message.key.id,
                mediaType: mediaType
            });
            
        } catch (error) {
            feature.logger?.error('❌ Error in media.download handler:', error);
        }
    }
};
