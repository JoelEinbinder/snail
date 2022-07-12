//
//  WebPanel.h
//  Terminal
//
//  Created by Joel Einbinder on 7/11/22.
//

#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface D4WebPanel : NSPanel <WKUIDelegate> {
    WKWebView* webView;
    bool positionAtBottom;
}
-(WKWebView*)webView;
-(instancetype)initWithWithConfiguration:(WKWebViewConfiguration *)configuration forNavigationAction:(WKNavigationAction *)navigationAction windowFeatures:(WKWindowFeatures *)windowFeatures screen:(NSScreen *) screen;
-(void)resize:(CGSize)size;
-(void)positionWithinTop:(CGPoint)top bottom:(CGPoint)bttom;
@end

NS_ASSUME_NONNULL_END
