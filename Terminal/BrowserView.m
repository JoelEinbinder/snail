//
//  BrowserView.m
//  Terminal
//
//  Created by Joel Einbinder on 11/10/22.
//

#import "BrowserView.h"

@implementation BrowserView
- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    if (self.onMessage)
        self.onMessage(message.body);
}
@end
