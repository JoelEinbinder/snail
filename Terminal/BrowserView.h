//
//  BrowserView.h
//  Terminal
//
//  Created by Joel Einbinder on 11/10/22.
//

#import <WebKit/WebKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface BrowserView : WKWebView <WKScriptMessageHandler>

-(void)dispose;
@property (nonatomic, copy, nullable) void (^onMessage)(id);

@end

NS_ASSUME_NONNULL_END
