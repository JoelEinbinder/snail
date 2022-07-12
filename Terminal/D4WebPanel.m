//
//  WebPanel.m
//  Terminal
//
//  Created by Joel Einbinder on 7/11/22.
//

#import "D4WebPanel.h"
#import <WebKit/WebKit.h>

@implementation D4WebPanel

-(WKWebView*)webView {
    return webView;
}
-(instancetype)initWithWithConfiguration:(WKWebViewConfiguration *)configuration forNavigationAction:(WKNavigationAction *)navigationAction windowFeatures:(WKWindowFeatures *)windowFeatures screen:(NSScreen*) screen {
    self = [self initWithContentRect:CGRectMake(100.0, 100.0, 50.0, 50.0) styleMask:0 backing:NSBackingStoreBuffered defer:NO screen:screen];
    webView = [[WKWebView alloc] initWithFrame: CGRectMake(0.0, 0.0, self.frame.size.width, self.frame.size.height) configuration:configuration];
    [webView setUIDelegate:self];
    [self setContentView:webView];
    [self setFloatingPanel:YES];
    positionAtBottom = false;
    webView.underPageBackgroundColor = [NSColor clearColor];
    [webView setValue:@false forKey:@"drawsBackground"];
    [self setBackgroundColor:[NSColor clearColor]];
    return self;
}
-(void)resize:(CGSize)size {
    float y = self.frame.origin.y;
    if (positionAtBottom)
        y += self.frame.size.height - size.height;
    [self setFrame:CGRectMake(self.frame.origin.x, y, size.width, size.height) display:YES];
}
-(void)positionWithinTop:(CGPoint)top bottom:(CGPoint)bottom {
    float overflowBottom = self.screen.frame.origin.y - (bottom.y - self.frame.size.height);
    float overflowTop = (top.y + self.frame.size.height) - (self.screen.frame.origin.y + self.screen.frame.size.height) + self.screen.frame.origin.y;
    
    positionAtBottom = (overflowBottom <= 0 || overflowBottom < overflowTop);
    CGPoint point;
    if (positionAtBottom)
        point = CGPointMake(bottom.x, bottom.y - self.frame.size.height);
    else
        point = CGPointMake(top.x, top.y);
    [self setFrame:CGRectMake(point.x, point.y, self.frame.size.width, self.frame.size.height) display:YES];
    [self setIsVisible:YES];
}

@end
